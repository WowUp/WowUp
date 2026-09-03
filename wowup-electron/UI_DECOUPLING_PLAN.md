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

## Phase 3 — TOC Parsing / Addon Folder Listing ⏳ not started

- Move `.toc` file parsing and addon-folder directory scanning out of the renderer
  (currently under `src/app/services/addons/` and `src/app/utils/`) into a main-process
  service + controller.
- Renderer keeps only the thin API wrapper; folder/file I/O moves fully to main.

## Phase 4 — Addon Scan / Sync ⏳ not started

- Move addon scanning/sync orchestration (matching installed folders to known addons,
  fingerprinting) out of `src/app/services/addons/addon.service.ts` into main.
- `AddonController` (`app/controllers/addon.controller.ts`) already owns addon *storage*
  CRUD (get/save addons) — this phase extends it (or adds a sibling controller) to own
  the scan/sync business logic too.

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
