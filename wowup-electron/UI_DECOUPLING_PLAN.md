# UI Decoupling Plan

Tracks progress moving business logic out of the Angular renderer (`src/app/`) and
into the Electron main process (`app/`), so a future UI swap only has to replace thin
API-wrapper services. See `CLAUDE.md` for the overall architecture summary — this file
is the source of truth for what's done vs. pending; update the checkboxes as phases
complete.

Pattern for each phase:
- Business logic + storage access moves into a `Controller` (`app/controllers/`,
  implementing `IpcController`) registered in `app/controllers/index.ts`.
- Renderer gets a thin API service in `src/app/services/api/` that only wraps
  `ipcRenderer.invoke()` — no business logic, no validation.
- Existing renderer services keep their public method signatures where practical so
  consuming components don't need to change; Angular-specific concerns that can't move
  (reactive state via RxJS `Subject`/`ReplaySubject`, `TranslateService`-dependent
  display strings) stay in the renderer and delegate storage/CRUD to the API service.

## Phase 1 — Warcraft Platform Detection ✅ done

- `WarcraftPlatform` (`app/services/warcraft/warcraft-platform.{service,win,mac,linux}.ts`)
- `WarcraftController` (`app/controllers/warcraft/warcraft.controller.ts`)
- `WarcraftApiService` (`src/app/services/api/warcraft-api.service.ts`)
- Old `warcraft.service.{impl,win,mac,linux}.ts` deleted from the renderer.

## Phase 2 — Warcraft Installation CRUD ✅ done

- `WarcraftInstallationController` (`app/controllers/warcraft/warcraft-installation.controller.ts`)
  owns the `wow_installations` electron-store key directly and implements
  add/remove/update/reorder/setSelected/getAll/setAll, including the "already exists" /
  "not found" validation that previously lived in the renderer.
- `WarcraftInstallationApiService` (`src/app/services/api/warcraft-installation-api.service.ts`)
  wraps the new `IPC_WARCRAFT_INSTALLATIONS_*` channels.
- `WarcraftInstallationService` (`src/app/services/warcraft/warcraft-installation.service.ts`)
  keeps its public method signatures (so the ~28 consuming components/services didn't
  need to change), the `wowInstallations$` `ReplaySubject` broadcast, and the
  `TranslateService`-based display-name generation (main process has no i18n), but
  delegates all storage/CRUD to `WarcraftInstallationApiService` instead of talking to
  `PreferenceStorageService` directly.

## Phase 3 — TOC Parsing / Addon Folder Listing ✅ done

- `TocService` (`app/services/toc/toc.service.ts`) is a straight port of the old
  renderer parsing logic onto `fs/promises` directly (no more per-file IPC round trips
  through the generic file channels). `TocController` (`app/controllers/toc/`) exposes
  it as `IPC_TOC_PARSE` / `IPC_TOC_GET_ALL_TOCS`; the dead, never-called
  `parseMetaData`/`stripColorCode`/`stripTextureCode` public methods were dropped
  rather than ported (verified unused anywhere in the monorepo).
- `WarcraftController` gained `listAddons`/`getAddonFolder` (backed by `fs/promises` +
  the main-process `TocService`), replacing what used to be a chain of `FileService`
  IPC calls (`listDirectories`, `statFiles`, `readdir` per folder, `parse` per `.toc`
  file) driven from the renderer — that whole scan is now one IPC round trip per
  installation instead of one per file.
- Renderer `TocService` and `WarcraftService.listAddons`/`.getAddonFolder` now delegate
  to `TocApiService` / `WarcraftApiService` and kept their exact public signatures, so
  none of the ~15 call sites across `addon.service.ts`, `addon-install.service.ts`, the
  addon providers, and `wtf-explorer.component.ts` needed to change.
- `TocService.getTocForGameType2` stayed client-side, unmigrated on purpose: it's pure
  data transformation over already-parsed `Toc[]` with no filesystem or Node dependency,
  so it isn't "business logic coupled to Electron" in the sense this plan cares about —
  same rationale as keeping `TranslateService`-based display names client-side in Phase 2.

## Phase 4 — Addon Scan / Sync ✅ done

- ✅ **Fingerprinting.** `AddonFingerprintController` (`app/controllers/scan/`) + `AddonScanService`
  (`app/services/scan/`) own folder fingerprinting behind a single
  `IPC_ADDON_GET_SCAN_RESULTS` channel that takes the sources it should produce.
  `WowUpFolderScanner`/`CurseFolderScanner` now take their filesystem access as deps from a
  shared `FolderScanContext`, so one folder is walked once and each file read once however
  many fingerprints are wanted — the two per-source channels it replaced each did their own
  walk and their own reads. Fingerprint values are pinned by characterization tests in
  `addon-scan.service.spec.ts`. A scan now fingerprints inside `prepareScan` (below); the
  channel stays for the post-install fingerprint in `addon-install.service.ts`.
- ✅ **Scan/sync orchestration**, split around the addon providers, which stay in the
  renderer until Phase 5. `AddonSyncController` (`app/controllers/scan/`) +
  `AddonSyncService` (`app/services/addons/`) expose three channels:
  - `IPC_ADDON_SCAN_PREPARE` takes just an installation id (plus, for a rescan, the providers
    a scan can't find again). Main works out the folder path, the symlink preference and the
    flavor's fingerprint sources itself, lists the folders, flags git checkouts, leaves out
    the non-rescan providers' folders, and fingerprints the rest.
  - The renderer then runs each enabled provider's `scan()` to set `matchingAddon`.
  - `IPC_ADDON_SCAN_COMPLETE` turns matched folders into addons (`scan-assembly.ts`: TOC
    external ids, grouping, unmatched/load-on-demand folders). The non-rescan providers'
    addons are read from main's own store at this point, and for a rescan main keeps the
    user's settings and replaces the installation's saved addons in one step.
  - `IPC_ADDON_SYNC_APPLY` applies one provider's `getAll`/`getAllBatch` answer
    (`sync-results.ts`) to main's *saved* copy of each addon, with no await between read and
    write, so a stale renderer copy can't overwrite a newer save. An addon not saved yet (an
    install still running) is updated from the caller's copy and returned, but not saved. The
    renderer copies the result back onto its addon objects by id and raises `syncError$`.
- Addon storage moved out of `AddonController` into `AddonRepository`
  (`app/services/addons/addon-repository.ts`), shared by both controllers. Addon folder
  listing moved out of `WarcraftController` into `AddonFolderService`
  (`app/services/warcraft/`), so services never depend on a controller.
- Pure rules both sides need live in `src/common/addons/`: TOC selection
  (`getTocForGameType2`), external-id collection and per-provider id validation (the Curse,
  GitHub and Wago providers' `isValidAddonId` now read the same table; TukUI/WoWInterface in
  `wowup-lib` keep their own copy), `getLatestFile`, `getFileTargetVersions`.
- Still renderer-side on purpose: the per-installation rescan queue (it has to span the
  provider step), `scanUpdate$`/`syncError$`/`scanError$` RxJS events, and the migrations
  that need `provider.shouldMigrate`.

## Phase 5 — Install / Remove Pipeline ✅ done (providers still renderer-side)

- `AddonInstallController` (`app/controllers/`) + main `AddonInstallService`
  (`app/services/addons/`) expose two channels:
  - `IPC_ADDON_INSTALL_FILE` takes a downloaded zip and the addon. Main backs up the installed
    folders, unzips, copies the new folders into AddOns (restoring the backup if that fails), marks the
    addon installed (version, folders, game versions, author/zip title from the tocs), collects toc
    external ids, carries over the original addon's ids on a provider switch, saves it, drops Unknown
    addons left on the same folders, and deletes the zip and unzip folder. Backing up / installing
    progress comes back on `IPC_ADDON_INSTALL_PROGRESS`. Main works from its saved copy where it has
    one: the folders to back up come from it, and the user's settings (auto-update, notifications,
    channel) are read again just before the save, so a change made during the download or install is
    kept. The zip must sit in main's `downloads` folder, or main refuses it and deletes nothing.
  - `IPC_ADDON_ADD_EXTERNAL_ID` adds one provider id to a saved addon, so the renderer's hub id
    lookup doesn't write the whole record back.
  - `IPC_ADDON_REMOVE` deletes an addon's folders and record (main's saved copy wins over the
    caller's), plus its dependencies when asked.
- Split around the two steps that still need a provider: the **download** stays in the renderer,
  because a failed download is retried after the provider re-syncs the addon for a fresh url, and the
  **hub id lookup** after an install (a Hub HTTP call) runs in the renderer once main returns.
- Renderer `AddonInstallService` is now the install queue only (concurrency, `addonInstalled$` /
  `installError$`, `onUpdate`, analytics, download + retry, hub id) behind
  `AddonInstallApiService` (`src/app/services/api/`). `AddonService.removeAddon` keeps its
  signature and emits `addonRemoved$` / analytics for every addon main removed.
- `unzipFile` / `copyPath` moved out of `ipc-events.ts` into `app/file.utils.ts`, shared by the
  legacy file channels and the install service. The download itself stays on the legacy
  `IPC_DOWNLOAD_FILE_CHANNEL`.
- `addon-rules.ts` gained the WowUp Hub id rule (Phase 4 had left it out, so Hub addons lost their
  own id from `externalIds` and logged "Invalid provider id WowUpHub|…") and
  `reconcileExternalIds`; the install service's duplicate copy of the external-id logic is gone.

## Phase 5b — Addon Providers ⏳ not started

- Move the providers (`src/app/addon-providers/`, ~2,600 lines on Angular's `HttpClient`,
  `CachingService`, `CircuitBreaker`, `UiMessageService`; the Wago token already arrives in main via
  the ad view) into main, with main-side HTTP and caching.
- Once they move: the scan's prepare → provider match → complete round trip from Phase 4 collapses
  into one main call, the rescan queue can move with it, and the download + retry and hub id lookup
  can join the main install pipeline.

## Phase 6 — `ipc-events.ts` Cleanup ⏳ not started

- Once all domains have dedicated controllers, retire the legacy
  `app/ipc-events.ts` grab-bag registry (or shrink it to only what genuinely doesn't
  fit the controller pattern, e.g. window-chrome events).
