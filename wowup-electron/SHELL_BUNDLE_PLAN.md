# Shell + Bundle Plan

Tracks progress splitting WowUp into a small, rarely-changing **signed shell** and a
downloadable, independently-signed **app bundle** (main-process logic + preload +
Angular UI + assets). Goal: most releases ship as a bundle only, with no Authenticode
signing request and no new installer; a signed binary is only needed when the shell
itself changes. This file is the source of truth for what's done vs. pending; update
the checkboxes as phases complete.

Why: Windows releases are signed through SSL.com eSigner (`electron-build/sign-windows.js`),
which bills per signature, and electron-builder calls the sign hook once per PE file
(app exe, NSIS installer, uninstaller, portable exe). Authenticode only covers PE
files, so JS/HTML/asset changes don't inherently need it — they only need it today
because they ship inside a new installer.

## Target architecture

**Signed shell** — `package.json` `main` points at `bootstrap.js` instead of
`app-build/app/main.js`. Contains:
- Electron / ow-electron, `build/Release/addon.node`, and dependencies that ship their
  own binaries (e.g. `win-ca`).
- `bootstrap.js`, which owns only what must run before or outside the bundle:
  - `app.requestSingleInstanceLock()` (today `app/main.ts:126`).
  - Protocol client registration (today `app/main.ts:162`; the mac
    `CFBundleURLTypes` entry is in Info.plist regardless).
  - Bundle selection, verification, loading, health tracking, and rollback.
  - The bundle downloader (see "Why the shell owns the downloader").
  - electron-updater, used for shell updates only.
- A baked-in bundle — the one built alongside that shell release — so first run and
  fallback work offline.
- `SHELL_API_VERSION`: an integer bumped whenever the contract the bundle relies on
  changes (shell paths, health API, native addon interface, Electron major).

**Bundle** — a single `.asar` file (Electron can `require()` from and `loadURL()` into
asar paths natively, and one hash covers everything):
- `main.js` — all of today's `app/` code bundled with esbuild into one file;
  `electron`, the `.node` addon, and `win-ca` stay external. Bundling matters because
  the main process `require()`s lodash, electron-store, electron-log, pushy-electron,
  adm-zip, yauzl, protobufjs, etc.; a bundle must be able to upgrade those without
  depending on whatever `node_modules` the installed shell shipped.
- `preload.js`, `assets/`.
- `renderer/` — a static web directory with an `index.html` entry point. Today it's
  the Angular `dist/` output, but the shell, manifest, and delivery pipeline must not
  assume Angular: a future React UI ships as the same bundle format with different
  `renderer/` contents. `main.js` and `renderer/` always ship together, so they can
  change in lockstep during the UI migration without version-pairing rules; the
  long-lived contract is the IPC layer (`app/controllers/`), not the UI.
- No Angular-specific build optimization (per-chunk deltas, etc.) — bundles ship
  whole. At ~6–9 MB compressed that's acceptable, and effort goes into decoupling
  instead.

One bundle per flavor (`wago`, `ow`); bundles contain no platform-specific code, so
the same bundle serves Windows, mac, and Linux.

**Manifest** (one per flavor/channel/shell API, also embedded for the baked-in bundle):

```json
{
  "flavor": "wago",
  "channel": "stable",
  "shellApi": 1,
  "version": "2.25.0",
  "sha256": "<hash of the compressed .asar.br download>",
  "asarSha256": "<hash of the decompressed bundle.asar, checked on every launch>",
  "urls": [
    "https://github.com/<owner>/wowup-bundles/releases/download/wago-2.25.0/wago-2.25.0-<sha256>.asar.br",
    "https://<mirror>.pages.dev/bundles/wago-2.25.0-<sha256>.asar.br"
  ],
  "rolloutPercent": 100,
  "revoked": ["2.24.9"],
  "issuedAt": "2026-10-20T00:00:00Z",
  "keyId": "2026-a",
  "signature": "<ed25519 over the canonical manifest minus signature>"
}
```

## Storage & delivery

Delivery must be free, so everything lives on GitHub, with Cloudflare Pages as a free
mirror. Nothing in delivery is trusted: every manifest is ed25519-signed and every
bundle is hash-checked, so hosts and mirrors only need to be available, not secure.

- **Dedicated public repo, `wowup-bundles`**, separate from the main repo.
  electron-updater's GitHub provider treats the newest release in the main repo as the
  shell update, so bundle releases there would be mistaken for shell updates; it also
  keeps the main releases page readable.
- **Bundles are release assets** in `wowup-bundles`: one release per bundle (tag
  `<flavor>-<version>`, asset `<flavor>-<version>-<sha256>.asar.br`, brotli-compressed
  with Node's built-in zlib). Published once, never replaced. Clients download via the
  direct `github.com/.../releases/download/...` URL, never `api.github.com` (60
  requests/hour per IP without a token).
- **Manifests are on GitHub Pages** for `wowup-bundles`, at
  `/<flavor>/<channel>/shell-api-<N>.json`. A Pages deploy swaps the whole site at
  once, unlike replacing a release asset (delete + re-upload leaves a 404 window).
  Pages' soft limit of 100 GB/month is far above ~1 KB manifests polled every few
  hours. Pages caches for up to ~10 minutes, so pulling a bundle takes that long plus
  the client's check interval; revocation and boot rollback cover the gap.
- **One manifest per shell API version**, so older shells keep receiving the last
  bundle they can run.
- **Mirror on Cloudflare Pages** (free, no bandwidth limit, 25 MB per file). CI deploys
  the same bundles and manifests there; manifests list GitHub first, the mirror second.
  This covers networks that block GitHub's download domain.
- **Promotion and rollback only touch manifests**: beta → stable is a commit that
  points the stable manifest at the existing bundle; pulling a bad bundle is
  republishing the previous version's manifest (with a new `issuedAt`) and adding the
  bad version to `revoked`.
- **Publish order**: upload the bundle release asset (and mirror copy) first, then
  sign and deploy the manifest, so a manifest never references a missing file.

Client rules for manifests:
- **Staged rollout without a server**: take an update only if
  `hash(installId) % 100 < rolloutPercent`.
- **Replay/downgrade protection**: reject a manifest whose `issuedAt` is older than the
  last accepted one, and never install a lower version than the current bundle unless
  the current one is in `revoked`. This blocks a compromised host or mirror from
  serving an old, validly-signed bundle with a known bug.
- **Revocation**: quarantine any installed bundle listed in `revoked`, even if it's
  currently active.

## Boot sequence

1. Take the single-instance lock and register protocols. Load the bundle
   **synchronously, before `ready`**, so mac `open-url` and Windows second-instance
   argv still reach the bundle's handlers.
2. Pick the newest bundle in `userData/bundles/` whose `shellApi` this shell supports
   and that isn't quarantined.
3. Verify on **every launch**, not just at download: sha256 the asar against
   `asarSha256`, then
   `crypto.verify(null, manifestBytes, publicKey, signature)` (ed25519, built into
   Node — no dependency). `userData` is writable by anything running as the user, so
   this is what prevents persisting code inside the signed process.
4. If nothing passes, use the baked-in bundle.
5. Write a "booting" marker, then `require(<bundle>/main.js)`. The bundle calls
   `shell.markHealthy()` once the main window is ready. Two consecutive boots without
   `markHealthy()` → quarantine that bundle and fall back to the previous healthy one
   (or the baked-in bundle).

Renderer keeps loading via `file://` (from the bundle path). Moving to a custom
`app://` scheme would change the origin and orphan existing localStorage/IndexedDB.

## Why the shell owns the downloader

If the bundle downloaded its own successor, a broken bundle could break its own update
path. Keeping check → download → verify → stage in the shell means a bad bundle is
always recoverable by rollback plus the next good bundle. New bundles activate on next
launch (or via a "restart to update" prompt that relaunches the app).

## What still requires a signed shell release

- Electron / ow-electron upgrades (Angular targets a specific Chromium; bump
  `SHELL_API_VERSION` so older shells don't pick up incompatible bundles).
- Native addon changes or new native dependencies.
- Protocol, installer, or Info.plist changes.
- Bootstrap changes or any other `SHELL_API_VERSION` bump.

Everything else — providers, UI, scan/sync, the UI decoupling phases — becomes
bundle-only.

## Phase 1 — Bootstrap entry point 🚧 in progress

No behavior change; just introduces the seam.

- [x] Add `app/shell/bootstrap.ts`, compiled to `app-build/app/shell/bootstrap.js`
      (added to `tsconfig.serve.json` `files`).
- [x] Move the single-instance lock and protocol registration from `main.ts` into the
      bootstrap; bootstrap then `require()`s the existing `main.js` from the same build.
      A losing second instance now exits before `main.js` loads at all, so it no longer
      runs `validateGpuCache` (which could delete the running instance's GPU cache),
      `initializeDefaultPreferences`, etc. before exiting.
- [x] Logging setup (`setAppLogsPath`, `log.initialize()`, file path) moved into the
      bootstrap too, since the shell needs to log before and around the bundle;
      `main.ts` reads the path from `shell.logPath`. Phase 2 must keep `electron-log`
      external to the bundle so both share the one initialized instance.
- [x] Point `package.json` `main` at the bootstrap.
- [x] `app/shell/shell-api.ts`: `SHELL_API_VERSION = 1` and the `WowUpShell` contract
      (`apiVersion`, `logPath`, `markHealthy()` as a no-op), handed over on
      `globalThis` so a separately built bundle can read it. `main.ts` calls
      `markHealthy()` on the main window's `ready-to-show`. Shell paths (`bundleRoot`,
      `shellRoot`, `nativeAddonPath`) are added in Phase 2 when something uses them.
- [x] Shell/bundle import boundary, enforced by `no-restricted-imports` in
      `.eslintrc.js`: nothing in `app/shell/` imports app code (only files inside
      `app/shell/`, packages, and built-ins), and app code may only import
      `shell/shell-api` and `shell/protocol-client`. `protocol-client.ts` moved from
      `app/utils/` into `app/shell/` (the bundle still uses it for the in-app protocol
      toggles in `ipc-events.ts`), and the shell has its own `WOWUP_PROTOCOL_NAME`, kept
      equal to `APP_PROTOCOL_NAME` by a spec. Specs are exempt from the rule. The
      bootstrap's `require()` of the bundle's `main.js` is the one intended crossing and
      isn't an import (since Phase 2 it's by runtime path, not a relative module).
- [x] `ng lint` now actually lints all of `app/`: its pattern was `app/**.ts`, which
      only matched top-level files, so `app/controllers/`, `app/services/`, etc. had
      never been linted (they turned out clean).
- [x] Verified on Windows (`electron .` with an isolated `--user-data-dir`): app starts
      and renders through the bootstrap; a second instance launched with a
      `wowup://` link exits in ~1s without loading `main.js`, and the running instance
      receives the link via `second-instance`.
- [ ] Verify on mac: launch, `open-url` protocol launches, and dock re-activation.
- [x] Verified the `ow` flavor on Windows (`ow:electron:serve-tsc`, then `ow-electron .`
      against `dist/` with an isolated `--user-data-dir`, after the boundary commit):
      starts through the bootstrap with `buildFlavor: "ow"`, Overwolf's log lines still
      route into `main.log`, and a second instance with a `wowup://` link exits without
      loading `main.js` while the running instance receives the link.

## Phase 2 — Make main-process code location-independent 🚧 in progress

- [x] The shell publishes `paths` on `WowUpShell` (`shellRoot`, `bundleRoot`,
      `nativeAddon`); for now both roots are `app.getAppPath()`. App code resolves files
      through `app/bundle-paths.ts`, which owns the bundle's layout (`dist/` and
      `assets/` under `bundleRoot`, `preload.js` next to the bundled `main.js`), so
      Phase 3's move to `renderer/` is a one-line change there. Routed through it:
  - [x] `main.ts` — renderer `dist/index.html`, `preload.js`, the Linux window icon, and
        the dev-only `electron-reload` paths.
  - [x] `ipc-events.ts` (`IPC_GET_ASSET_FILE_PATH`), `system-tray.ts`,
        `wago-ad-view.service.ts`, `wago-cmp-window.service.ts` — `assets/` → bundle.
  - [x] `hash-algorithms.ts` — native addon → `shell.paths.nativeAddon`.
  - [x] `shell/protocol-client.ts` keeps `app.getAppPath()`: it's shell code, so that
        is already the shell's path.
- [x] `scripts/build-main.js` (esbuild, pinned `0.20.1` dev dependency) builds two
      separate bundles: the shell (`app/shell/bootstrap.ts` → `app-build/shell/`) and
      the app (`app/main.ts` + `app/preload.ts` → `app-build/bundle/`). It clears
      `app-build/` first. `package.json` `main` is now `app-build/shell/bootstrap.js`,
      which loads `<bundleRoot>/app-build/bundle/main.js` by runtime path.
      `electron:serve-tsc` / `ow:electron:serve-tsc` run `tsc -p tsconfig.serve.json`
      (now `noEmit`, type-check only) and then the build script.
- [x] Externals, loaded from `node_modules` at runtime: `electron`, `electron-log`
      (initialized once by the shell, shared with the bundle), `electron-updater`
      (updates the shell), `win-ca` (loads `.node` files and `roots.exe` from its own
      folder), `electron-reload` (dev only). Everything else is bundled.
- [x] Four call sites used `import * as X` on a callable/constructable CommonJS module
      (`minimist`, `electron-store`, `adm-zip`, `globrex`), which works with tsc's output
      but crashes once bundled; switched to `import X = require(...)`, the form
      `ipc-events.ts` already used. The build now has no warnings.
- [x] `npm run test:main` passes (specs still compile with tsc, unaffected by bundling).
- [x] `no-restricted-syntax` in `.eslintrc.js` flags `app.getAppPath()` and
      `__dirname`/`__filename` in `app/**` outside `app/shell/` and `bundle-paths.ts`.
- [x] Verified on Windows, both flavors, isolated `--user-data-dir`: starts through
      the shell bundle, preload runs (`win-ca loaded`), renderer loads, tray icon
      resolves via `bundle-paths`; ow flavor second-instance + `wowup://` handoff still
      works.
- [ ] Not exercised: the native addon (only loaded during a curseforge fingerprint
      scan in the ow flavor) and the wago ad/consent windows' preload scripts. Both now
      resolve through `bundle-paths`; check them in the next full manual test.
- [ ] Verify on mac.

## Phase 3 — Bundle build + signing in CI ⏳ not started

- [ ] Move the shell out of `wowup-electron` into its own package (e.g. `wowup-shell/`)
      once the shell and bundle builds are actually separate. The shell is effectively
      the packaging project — Electron/ow-electron, electron-builder configs, the native
      addon (`binding.gyp`), signing scripts, installer config — so all of that moves with
      `app/shell/`. The Phase 1 lint boundary should make the code side mechanical.

- [ ] Script that assembles `bundle.asar` (`main.js`, `preload.js`, `renderer/` from
      the current UI build output, `assets/`), brotli-compresses it to `.asar.br`, and
      writes the unsigned manifest (both hashes, `urls`, `issuedAt`).
- [ ] Generate the ed25519 key pair; private key only in CI secrets. Embed two public
      keys (current + next, selected by `keyId`) in the shell so keys can rotate
      without a shell release.
- [ ] Create the public `wowup-bundles` repo with GitHub Pages enabled for manifests.
- [ ] Set up the Cloudflare Pages mirror project.
- [ ] CI job (GitHub Actions), per flavor: build bundle → create `<flavor>-<version>`
      release in `wowup-bundles` with the `.asar.br` asset → deploy the same file to
      the mirror → sign the manifest → deploy manifests to GitHub Pages and the mirror.
      Manifests last, so they never reference a missing file.
- [ ] Promotion workflow: a manual-dispatch job that re-signs and redeploys a
      channel's manifest pointing at an existing bundle (beta → stable, rollback,
      `rolloutPercent` changes, `revoked` updates) without rebuilding.
- [ ] electron-builder config includes the baked-in bundle + manifest in the shell
      package for every target (wago and ow flavors).

## Phase 4 — Loader, verification, rollback ⏳ not started

- [ ] Bootstrap selects bundles from `userData/bundles/<version>/` by `shellApi` and
      version, skipping quarantined ones.
- [ ] Make the bundle's externals (see Phase 2) resolve from the shell's `node_modules`:
      once a bundle loads from `userData`, Node won't find them by walking up from the
      bundle's folder (e.g. add the shell's `node_modules` to the bundle module's lookup
      paths).
- [ ] Per-launch sha256 + ed25519 verification; fall back to the baked-in bundle on
      failure (and log why).
- [ ] Booting marker + `markHealthy()` (called by the bundle when the main window is
      ready); quarantine after two unhealthy boots.
- [ ] Prune old bundles, keeping the active one and the last known-good one.
- [ ] Tests for the selection / verification / rollback logic with tampered,
      wrong-`shellApi`, and crash-looping bundles.

## Phase 5 — Bundle updater ⏳ not started

- [ ] Shell polls `/<flavor>/<channel>/shell-api-<N>.json` (channel from the existing
      release-channel preference) using conditional requests, trying each manifest
      host in order.
- [ ] Manifest acceptance rules: signature valid, `issuedAt` not older than the last
      accepted manifest, `hash(installId) % 100 < rolloutPercent`, no downgrade unless
      the current bundle is in `revoked`.
- [ ] Download from `urls` in order, check `sha256`, decompress, check `asarSha256`,
      and stage into `userData/bundles/<version>/`.
- [ ] Quarantine any installed bundle listed in `revoked`.
- [ ] Renderer "restart to update" prompt for staged bundles, alongside the existing
      shell-update UI from `app/app-updater.ts`.

## Phase 6 — Shell hardening + cutover release ⏳ not started

- [ ] Enable Electron fuses in the shell build: disable `RunAsNode` and Node CLI
      inspect arguments, enable embedded asar integrity validation. Today no fuses are
      set, so the signed exe can be used as a signed Node runtime.
- [ ] Ship the shell as the last "big" signed release.
- [ ] Document the release flow: bundle-only by default; shell releases planned around
      Electron upgrades.

## Open questions

- **Overwolf flavor**: does ow-electron / Overwolf distribution policy allow loading
  code that isn't in the package? May need the ow flavor to stay on full releases.
- **MSIX**: an `appx` target signs the whole package with one signature and supports
  differential updates — worth evaluating for shell releases, but it changes install
  location and replaces the electron-updater/NSIS flow.
- **Interaction with UI decoupling**: once the renderer no longer needs Node
  (`nodeIntegration: false`), loading the UI remotely becomes viable; until then the UI
  must only ever come from a verified local bundle.
