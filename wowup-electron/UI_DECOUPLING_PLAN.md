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

## Phase 4 — Addon Scan / Sync 🚧 in progress

- ✅ **Fingerprinting.** `AddonScanController` (`app/controllers/scan/`) + `AddonScanService`
  (`app/services/scan/`) own folder fingerprinting behind a single
  `IPC_ADDON_GET_SCAN_RESULTS` channel that takes the sources it should produce.
  `WowUpFolderScanner`/`CurseFolderScanner` now take their filesystem access as deps from a
  shared `FolderScanContext`, so one folder is walked once and each file read once however
  many fingerprints are wanted — the two per-source channels it replaced each did their own
  walk and their own reads. Renderer side is `addon-scan-api.service.ts`, consumed by
  `AddonFingerprintService`. Fingerprint values are pinned by characterization tests in
  `addon-scan.service.spec.ts`.
- ⏳ **Scan/sync orchestration.** Still in `src/app/services/addons/addon.service.ts`:
  matching scanned folders back to known addons, and the sync pipeline around it.
- `AddonController` (`app/controllers/addon.controller.ts`) already owns addon *storage*
  CRUD (get/save addons) — the remaining orchestration extends it (or adds a sibling
  controller).

## Phase 5 — Install / Remove Pipeline ⏳ not started

- Move addon install/update/remove orchestration (currently
  `src/app/services/addons/addon-install.service.ts` and the addon providers under
  `src/app/addon-providers/`) into main.
- Addon providers still make their own HTTP calls from the renderer today — decide
  whether provider HTTP calls move to main as part of this phase or stay renderer-side
  behind a thinner install pipeline.

## Phase 6 — `ipc-events.ts` Cleanup ⏳ not started

- Once all domains have dedicated controllers, retire the legacy
  `app/ipc-events.ts` grab-bag registry (or shrink it to only what genuinely doesn't
  fit the controller pattern, e.g. window-chrome events).
