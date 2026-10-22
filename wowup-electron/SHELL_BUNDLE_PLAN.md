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

**Bundle** — a self-contained folder, downloaded as one `.zip`. It is deliberately
**not** an `.asar`: Electron's embedded asar integrity check (`EnableEmbeddedAsarIntegrityValidation`,
already on in ow-electron and planned for the shell in Phase 6) aborts the app on any
`.asar` the exe doesn't list, which would include every downloaded bundle. Contents:
- `main.js` — all of today's `app/` code bundled with esbuild into one file;
  `electron`, `electron-log`, `electron-updater`, the `.node` addon, and `win-ca` stay
  external and resolve from the shell's `node_modules`. Bundling matters because
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
  "sha256": "<hash of the .zip download>",
  "contentSha256": "<hashBundleDirectory() of the unpacked folder, checked on every launch>",
  "urls": [
    "https://github.com/<owner>/wowup-bundles/releases/download/wago-2.25.0/wago-2.25.0-<sha256>.zip",
    "https://<mirror>.pages.dev/bundles/wago-2.25.0-<sha256>.zip"
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
  `<flavor>-<version>`, asset `<flavor>-<version>-<sha256>.zip`, ~6.7 MB). Published
  once, never replaced. Clients download via the
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
- **Mirror on Cloudflare Pages** (deferred: GitHub only for now). Free, no bandwidth limit, 25 MB per file. CI deploys
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
2. Pick the newest bundle folder in `userData/bundles/` whose `shellApi` this shell
   supports and that isn't quarantined.
3. Verify on **every launch**, not just at download: `hashBundleDirectory()` the folder
   against `contentSha256` (~14 MB, a few tens of ms), then
   `crypto.verify(null, manifestBytes, publicKey, signature)` (ed25519, built into
   Node — no dependency). `userData` is writable by anything running as the user, so
   this is what prevents persisting code inside the signed process.
4. If nothing passes, use the baked-in bundle (`resources/bundle/`).
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
      through `app/bundle-paths.ts`, which owns the bundle's layout (at the time `dist/`
      and `assets/` under `bundleRoot`, `preload.js` next to the bundled `main.js`;
      Phase 3 moved everything under `bundleRoot`). Routed through it:
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
- [x] Native addon (via `shell.paths.nativeAddon`): an ow-flavor addon scan of real
      installs matched 32 addons as CurseForge, which relies on the native murmur
      fingerprints; no load or scan errors.
- [x] Wago ad and consent preloads (via `getAssetPath`), wago flavor with the Wago.io
      provider enabled: the consent window logged `[cmp-preload] init` and closed itself
      through `window.electronAPI.closeCMP()`, and the ad view logged
      `[wago-preload] init` and exposes `window.wago.provideApiKey` with no Node
      `require` in the page.
- [ ] Verify on mac.

## Phase 3 — Bundle build + signing in CI 🚧 in progress

Steps 1–3 (local) are done; step 4 (CI publishing) is written and waits on the one-time
repo/key/secret setup listed under it; step 5 (moving the shell) comes last.

**Step 1 — self-contained bundle folder + packaging**
- [x] `app-build/bundle/` is the whole bundle: `build-main.js` writes `main.js`,
      `preload.js` and copies `assets/`; `ng build` now outputs straight into
      `app-build/bundle/renderer/` (`angular.json` `outputPath`). `build-main.js` no
      longer wipes `app-build/`, only what it produces, so it can run after `ng build`.
- [x] `bundle-paths.ts` resolves everything (including `preload.js`) from `bundleRoot`;
      no `__dirname` left in app code, so `bundle-paths.ts` lost its lint exemption.
- [x] `scripts/build-bundle.mts` stages `app-build/packed/bundle/` (no source maps),
      zips it to `app-build/packed/bundle.zip` (~6.7 MB), and writes the unsigned
      `bundle-manifest.json` (`sha256` of the zip, `contentSha256` of the folder,
      `channel` from the version, `issuedAt`). Runs as the npm `postbuild` /
      `postow:build` script, since appending it to `build` would receive the
      `-- -c production` arguments meant for `ng build`.
- [x] Bundles are folders, not `.asar` (see "Target architecture"): a packaged
      ow-electron build aborted with `Failed to find file integrity info for
      resources\bundle.asar` when the bundle was an asar. Format switched to
      folder + zip, and `asarSha256` became `contentSha256`.

**Step 2 — signing tools**
- [x] `app/shell/bundle-manifest.ts`: manifest types, canonical signed bytes (sorted
      keys, `keyId` included, `signature` excluded), `signManifest`, `verifyManifest`,
      `hashBundleDirectory`. One source shared by the shell and the scripts: Node 24
      runs the `scripts/*.mts` files as TypeScript directly, so the file stays
      type-strippable with only node built-in imports. Specs cover rotation, tampering,
      key-id swaps, unknown keys, malformed signatures, field order, and the folder hash.
- [x] `scripts/generate-bundle-key.mts <key-id> <private-key-file>` creates the ed25519
      pair (refuses to overwrite), prints the `BUNDLE_PUBLIC_KEYS` entry. Run it
      yourself; store the private key as the `BUNDLE_SIGNING_KEY` secret and the id as
      `BUNDLE_SIGNING_KEY_ID`.
- [x] `scripts/sign-manifest.mts <manifest> [out]` signs with those env vars and
      verifies the result against the derived public key before writing.
- [x] `app/shell/bundle-keys.ts` holds `BUNDLE_PUBLIC_KEYS` (empty until the first key
      is generated; checking signatures is Phase 4).
- [ ] Generate the real key pair and add its public key (needs you).

**Step 3 — installers ship their own bundle**
- [x] All four electron-builder configs: `app.asar` now holds only
      `app-build/shell/**/*.js` and the native addon (plus `node_modules`);
      `app-build/packed/bundle/` ships as `resources/bundle/` and the manifest as
      `resources/bundle-manifest.json` via `extraResources`.
- [x] The bootstrap loads `resources/bundle/` when `app.isPackaged`, otherwise
      `app-build/bundle/`.
- [x] Externals resolve from the shell's `node_modules` (pulled forward from Phase 4):
      the bootstrap prepends it to `NODE_PATH` and re-runs `Module._initPaths()`, and
      keeps `NODE_PATH` set so renderers inherit it. Electron's renderer startup clears
      Node's global search paths, so the preload re-runs `_initPaths()` first thing
      (`app/preload-node-path.ts`).
- [x] Verified with an unpacked ow-electron-builder build (`--dir`, local-ow config,
      no signing): main, preload (`win-ca loaded`, `window.wowup` present), tray and UI
      all load from `resources/bundle/`; unpackaged `electron .` loads
      `app-build/bundle/renderer/`. Not yet tried: a full installer, the wago config,
      mac, Linux.

**Step 4 — CI publishing** (workflows written and dry-run locally; needs the one-time
setup below before the first real run)
- [x] Decided: both flavors publish to `WowUp/wowup-bundles` (tags and manifest paths
      already include the flavor). The Cloudflare mirror is left out for now.
- [x] `scripts/lib/channel-manifest.mts` (`buildChannelManifest`): the publish rules —
      carry the channel's `revoked` list forward, refuse to go back to an older version
      unless the current one is revoked, refuse to publish a revoked version, always
      issue later than the current manifest, validate channel and rollout. Tested with
      Node's built-in runner (`npm run test:scripts`, now part of `npm test`).
- [x] `scripts/publish-manifest.mts`: writes the signed channel manifest
      (`<flavor>/<channel>/shell-api-<N>.json`) into a checkout of the Pages repo, plus a
      per-version record (`<flavor>/versions/<version>.json`, unsigned, with its URLs)
      used for promotion. Refuses to record a version twice with different content.
- [x] `compareVersions` added to `app/shell/bundle-manifest.ts` (the shell needs the same
      ordering for its no-downgrade rule in Phase 5), with specs.
- [x] `scripts/lib/signing.mts` (`signWithEnvKey`) is the one signing path; `build-bundle.mts`
      now signs the manifest whenever `BUNDLE_SIGNING_KEY(_ID)` are set, so installers built
      by the existing release workflows ship a signed manifest. Those workflows' publish steps
      (all 9) now pass the two secrets; without them, builds stay unsigned as before.
- [x] `.github/workflows/bundle-publish.yml` (manual: flavor, channel, rollout): builds the
      bundle on Ubuntu, uploads `<flavor>-<version>-<sha256>.zip` as release
      `<flavor>-<version>` in `wowup-bundles` (refuses if that release exists — bump the
      version or promote instead), then pushes the signed manifest. No installer, no
      code signing.
- [x] `.github/workflows/bundle-promote.yml` (manual: flavor, version, channel, rollout,
      revoke): re-signs a channel manifest from a version record without rebuilding —
      beta → stable, rollout changes, rollbacks (publish the previous version with
      `revoke` set to the bad one).
- [x] Both share a `wowup-bundles` concurrency group so they never push at the same time;
      inputs reach scripts through `env:`, never pasted into the shell script.
- [x] Dry run with a throwaway key and a scratch Pages folder: signed build, publish to
      beta, promote to stable, a refused downgrade, a rollback with revoke, a refused
      re-publish of the revoked version and of changed content; the channel manifests
      verify. The workflows themselves haven't run yet.
- [ ] One-time setup (yours):
  1. Create the **public** repo `WowUp/wowup-bundles` with at least one commit on its
     default branch (an empty `README.md` and a `.nojekyll` file, so Pages serves files
     as-is). Turn on GitHub Pages from the default branch, root folder; manifests will
     be at `https://wowup.github.io/wowup-bundles/<flavor>/<channel>/shell-api-<N>.json`.
  2. Generate the signing key: `node scripts/generate-bundle-key.mts <key-id> <file>`.
     Add the printed entry to `BUNDLE_PUBLIC_KEYS` in `app/shell/bundle-keys.ts` and
     commit that; then delete the private key file once it's stored as a secret.
  3. Add secrets to `WowUp/WowUp`: `BUNDLE_SIGNING_KEY` (the whole PEM file),
     `BUNDLE_SIGNING_KEY_ID`, and `WOWUP_BUNDLES_TOKEN` — a fine-grained token limited to
     `WowUp/wowup-bundles` with Contents: read and write.
  4. Run **Publish bundle** for one flavor on `beta`, and check the release, the manifest
     commit, and the Pages URL.
- [ ] Cloudflare Pages mirror — later, as a separate change.

**Step 5 — move the shell into its own package**
- [ ] Move the shell out of `wowup-electron` into its own package (e.g. `wowup-shell/`)
      once 1–4 work. The shell is effectively the packaging project — Electron/
      ow-electron, electron-builder configs, the native addon (`binding.gyp`), signing
      scripts, installer config — so all of that moves with `app/shell/`. The Phase 1
      lint boundary should make the code side mechanical.

## Phase 4 — Loader, verification, rollback ⏳ not started

- [ ] Bootstrap selects bundles from `userData/bundles/<version>/` by `shellApi` and
      version, skipping quarantined ones.
- [x] Make the bundle's externals resolve from the shell's `node_modules` — done in
      Phase 3 step 3, since the baked-in `resources/bundle/` needed it too.
- [ ] Per-launch `hashBundleDirectory()` + ed25519 verification (`verifyManifest`
      against `BUNDLE_PUBLIC_KEYS`); fall back to the baked-in bundle on failure (and
      log why). Decide whether the baked-in bundle is verified too or trusted as part of
      the signed install.
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
- [ ] Download from `urls` in order, check `sha256`, unzip (with `adm-zip`, already
      shipped) into `userData/bundles/<version>/`, check `contentSha256`. The zip is
      only opened after its hash matches the signed manifest.
- [ ] Quarantine any installed bundle listed in `revoked`.
- [ ] Renderer "restart to update" prompt for staged bundles, alongside the existing
      shell-update UI from `app/app-updater.ts`.

## Phase 6 — Shell hardening + cutover release ⏳ not started

- [ ] Enable Electron fuses in the shell build: disable `RunAsNode` and Node CLI
      inspect arguments, enable embedded asar integrity validation. Today the wago
      flavor (stock Electron) sets none; ow-electron already enables
      `EnableEmbeddedAsarIntegrityValidation` and `OnlyLoadAppFromAsar` but leaves
      `RunAsNode` and the inspect arguments on, so either signed exe can be used as a
      signed Node runtime. Bundles being folders keeps them compatible with the
      integrity fuse.
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
