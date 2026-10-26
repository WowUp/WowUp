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

## Status

Phases 1–5 are done on Windows. The shell (`wowup-shell/`) loads a signed bundle
(built in `wowup-electron/`), verifies it on every launch, rolls back bundles that fail
to start, and downloads and stages newer bundles, which the app offers to restart into
(required after 6 hours, or at once if the running bundle is revoked). CI publishes
bundles to `WowUp/wowup-bundles`; both flavors have 2.25.0-beta.1 on the beta channel.

Next: the cutover release that ships this shell (Phase 6). The fuses are done.
Still unverified anywhere: mac and Linux, and a real release workflow run since the
shell moved. The open items are listed under "Phases 1–5" below.

## Target architecture

**Signed shell** — the `wowup-shell/` package, whose `main` is `dist/bootstrap.js`.
Contains:
- Electron / ow-electron, `build/Release/addon.node`, and the packages the bundle
  loads from the shell's `node_modules`: `electron-log`, `electron-updater`, and
  `win-ca` (which ships its own binaries).
- `bootstrap.js` (`src/bootstrap.ts`), which owns only what must run before or outside
  the bundle:
  - `app.requestSingleInstanceLock()`.
  - Protocol client registration (the mac `CFBundleURLTypes` entry is in Info.plist
    regardless).
  - Bundle selection, verification, loading, health tracking, and rollback
    (`src/bundle-loader.ts`).
  - The bundle updater (`src/bundle-updater.ts`; see "Why the shell owns the
    downloader").
- electron-updater still replaces the shell itself (installer releases). The bundle's
  `app/app-updater.ts` drives it, loading it from the shell's `node_modules`.
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
    "https://github.com/WowUp/wowup-bundles/releases/download/wago-2.25.0/wago-2.25.0-<sha256>.zip"
  ],
  "rolloutPercent": 100,
  "revoked": ["2.24.9"],
  "issuedAt": "2026-10-20T00:00:00Z",
  "keyId": "2026-a",
  "signature": "<ed25519 over the canonical manifest minus signature>"
}
```

## Storage & delivery

Delivery must be free, so everything lives on GitHub (a Cloudflare Pages mirror is
planned for later). Nothing in delivery is trusted: every manifest is ed25519-signed and every
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
  `sha256("<installId>:<version>") % 100 < rolloutPercent`. The shell generates the
  install ID. Salting with the version means the same installs aren't always first.
- **Replay/downgrade protection**: reject a manifest whose `issuedAt` is older than the
  last accepted one, and never install a lower version than the current bundle unless
  the current one is in `revoked`. This blocks a compromised host or mirror from
  serving an old, validly-signed bundle with a known bug.
- **Revocation**: versions in `revoked` are never loaded again (a revoked built-in
  bundle only when nothing else can be). If the running bundle is revoked, its
  replacement is downloaded even if it's older or outside the rollout, and the app
  requires a restart.

## Boot sequence

1. Take the single-instance lock and register protocols. Load the bundle
   **synchronously, before `ready`**, so mac `open-url` and Windows second-instance
   argv still reach the bundle's handlers.
2. Candidates are the downloaded bundles in `userData/bundles/<version>/` plus the
   built-in one (`resources/bundle/`), newest first by what their manifests claim. The
   built-in bundle wins a tie, and goes last if it's revoked. Downloads that were set
   aside or revoked are skipped.
3. Verify each candidate on **every launch**, not just at download, built-in included:
   the manifest's ed25519 signature (`crypto.verify`, built into Node), its flavor,
   shell API and version, then `hashBundleDirectory()` of the folder against
   `contentSha256` (~0.1 s). `userData` and the per-user install folder are writable by
   anything running as the user, so this is what prevents persisting code inside the
   signed process. The first candidate that passes is loaded.
4. If nothing passes, show "WowUp can't start … please reinstall" and exit.
5. Count the start in `state.json`, then `require(<bundle>/main.js)`. The bundle calls
   `shell.markHealthy()` once the main window is ready. A download that reaches two
   starts without `markHealthy()` is set aside, and the next candidate loads. The
   built-in bundle is never set aside.

Renderer keeps loading via `file://` (from the bundle path). Moving to a custom
`app://` scheme would change the origin and orphan existing localStorage/IndexedDB.

## Why the shell owns the downloader

If the bundle downloaded its own successor, a broken bundle could break its own update
path. Keeping check → download → verify → stage in the shell means a bad bundle is
always recoverable by rollback plus the next good bundle. New bundles activate on the
next launch, or when the user accepts the app's restart prompt (required after 6 hours).

## What still requires a signed shell release

- Electron / ow-electron upgrades (Angular targets a specific Chromium; bump
  `SHELL_API_VERSION` so older shells don't pick up incompatible bundles).
- Native addon changes or new native dependencies.
- Protocol, installer, or Info.plist changes.
- Bootstrap changes or any other `SHELL_API_VERSION` bump.

Everything else — providers, UI, scan/sync, the UI decoupling phases — becomes
bundle-only.

## Phases 1–5 ✅ done (Windows)

What each phase did, how it was verified and the testing notes are in
[SHELL_BUNDLE_HISTORY.md](SHELL_BUNDLE_HISTORY.md). Still open from those phases:

- [ ] Phase 1 — verify on mac: launch, `open-url` protocol launches, and dock re-activation.
- [ ] Phase 2 — verify on mac.
- [ ] Phase 3 — Cloudflare Pages mirror — later, as a separate change.
- [ ] Phase 3 — not done: VS Code debugging (configs updated but not run), a real release
      workflow run, mac and Linux.
- [ ] Phase 4 — not checked: mac and Linux (the wago packaged build and the renderer's karma
      tests were checked in Phase 5), and the refuse-to-start dialog's appearance (only its
      log line).
- [ ] Phase 5 — not checked: mac and Linux.

Local-only follow-ups from Phase 3: the mac notarize hooks now read `wowup-shell/.env`
instead of `wowup-electron/.env` — move or copy it if you notarize locally. `gulpfile-ow.js`
and `.travis.yml` look unused (nothing references them) and can be deleted separately.

## Phase 6 — Shell hardening + cutover release 🚧 in progress

- [x] Electron fuses, set with electron-builder's `electronFuses` in all four
      `wowup-shell/electron-build/electron-builder*.json` configs (both builders flip
      them right before signing): `runAsNode`, `enableNodeOptionsEnvironmentVariable`
      and `enableNodeCliInspectArguments` off; `enableEmbeddedAsarIntegrityValidation`
      and `onlyLoadAppFromAsar` on (ow-electron-builder forces those two on Windows
      anyway). Cookie encryption (one-way) and `file://` privileges (the renderer
      loads from `file://`) are left at their defaults. Nothing in the app uses
      `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS`, `fork` or `--inspect`, and `NODE_PATH`,
      which the shell relies on, isn't covered by any fuse. Dev runs use the
      unpackaged Electron, so debugging is unaffected.
- [x] Verified with packaged `--dir` builds of both flavors (wago packaged with a no-op
      signing hook, so the resource editing a release does still runs after the
      integrity hash is embedded). `@electron/fuses read` shows the fuses flipped. Both
      start normally, load the built-in bundle (preload and `win-ca` included), and wago
      downloaded and then loaded a newer bundle folder. Each fuse blocks its target,
      with the stock Electron binary as a control that allows it: a run-as-node
      script, a `NODE_OPTIONS --require` script and an `--inspect` debugger all do
      nothing against the fused exes (the app just starts). An `app.asar` with an
      edited `dist/bootstrap.js` stops at "Integrity check failed for asar archive"
      before any shell code runs.
- [x] Updater against the real hosts: `BUNDLE_UPDATE_URL` at build time (comma-separated)
      points a local build at other manifest hosts; manifests are still checked against
      the trusted keys. A packaged ow build with a local 2.25.0-beta.0 built in, pointed
      at `https://wowup.github.io/wowup-bundles`, fetched the live beta manifest, took the
      published ow 2.25.0-beta.1 (signed with `2026-a`) through GitHub's release download
      redirect, verified and staged it in ~10 s. After a restart it loaded that bundle,
      which predates `setChannel()`, and the shell fell back to its `beta` channel after
      exactly 30 s ("already running"). Nothing was published for this.
- [ ] Ship the shell as the last "big" signed release: a `publish:never` run of the
      release workflows first (not run since the shell moved), then the release.
- [x] Release flow, below.

### Release flow

Every version, bundle or shell, comes from `wowup-electron/package.json`. A bundle
version is published once and never replaced, so bump the version for every publish,
however small.

**Bundle-only release** (the default: providers, UI, scan/sync, anything in `app/` or
`src/`):
1. Bump the version on the release branch and push.
2. Run **Publish bundle** (`bundle-publish.yml`) per flavor, usually to `beta` first.
   It builds the bundle, signs its manifest with `BUNDLE_SIGNING_KEY`, uploads the zip
   as a release in `WowUp/wowup-bundles` and points the channel's manifest at it. Use
   `rollout` below 100 to stage it.
3. Installs pick it up within ~4 hours (Pages caches manifests for up to ~10 minutes),
   ask to restart, and require it after 6 hours.
4. To widen a rollout or move a version to `stable`, run **Promote bundle**
   (`bundle-promote.yml`) with the published version: it only rewrites the manifest.

**Pulling a bad bundle**: run **Promote bundle** with the last good version and the bad
one in `revoke`. Installs running the bad version download the good one even if it's
older or outside the rollout, and must restart. A revoked version is never loaded
again.

**Shell release** (needs Authenticode signing and new installers): only for an
Electron / ow-electron upgrade, native addon changes, protocol or installer changes,
or bootstrap changes. Bump `SHELL_API_VERSION` when bundles start relying on something
new from the shell, so older shells keep getting the last bundle they can run.
1. Run **Build WowUp Electron All** (`electron-all-build.yml`, wago) and **Build WowUp
   Electron All CF** (`electron-ow-all-build.yml`, ow). Each builds the bundle, embeds
   it in Windows, mac and Linux installers (Windows signed through SSL.com), and uploads
   them as a draft release to `WowUp/WowUp` or `WowUp/WowUp.CF`, where electron-updater
   finds them once published. If one platform fails, **Re-run failed jobs** reruns only
   that one, without signing Windows again.
2. Also run **Publish bundle** for the same version, so installs that already have
   that shell can get it as a bundle update too.

## Open questions

- ~~**Overwolf flavor**: does ow-electron / Overwolf distribution policy allow loading
  code that isn't in the package?~~ Resolved: Overwolf doesn't review WowUp's app, so
  the ow flavor uses bundle updates like wago.
- **MSIX**: an `appx` target signs the whole package with one signature and supports
  differential updates — worth evaluating for shell releases, but it changes install
  location and replaces the electron-updater/NSIS flow.
- **Interaction with UI decoupling**: once the renderer no longer needs Node
  (`nodeIntegration: false`), loading the UI remotely becomes viable; until then the UI
  must only ever come from a verified local bundle.
