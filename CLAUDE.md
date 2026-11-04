# WowUp Monorepo

WowUp is a World of Warcraft addon manager.

## Repository Structure

| Package | Tech Stack | Purpose |
| :--- | :--- | :--- |
| `wowup-electron/` | Electron 43 + Angular 17 | Main desktop client (primary). Builds the **app bundle**: main process (`app/`), preload and renderer (`src/`). Dev runs and tests start here. |
| `wowup-shell/` | TypeScript + electron-builder | The signed **shell** that loads the app bundle, plus everything that builds installers: Electron/ow-electron packaging, `electron-build/` configs and signing, the native addon. `contract/` is the only part app code may import. |
| `wowup-lib/` | TypeScript + Parcel | Shared core library (`wowup-lib-core`) consumed by the Electron app. |
| `v3/` | TypeScript | Next-generation client (early development). |

## Architecture (coupled UI, mid-migration)

- `nodeIntegration: true` / `contextIsolation: false` (`app/main.ts`): the Angular UI imports Node APIs (`fs`, `path`, …) directly.
- Not yet migrated, still in the renderer: addon providers (`src/app/addon-providers/`, all HTTP and scraping) and addon scan/sync and install/remove (`src/app/services/addons/`).
- Main process (`app/`): legacy `app/ipc-events.ts` registry, plus **Controllers** (`app/controllers/`, implementing `IpcController`, registered in `app/controllers/index.ts`) and main-process services (`app/services/`) for migrated logic.
- Migrated domains get a thin renderer wrapper in `src/app/services/api/` (e.g. `warcraft-api.service.ts`) that only wraps `ipcRenderer.invoke()` — no business logic.
- There is no `Procedure<I, O>` / `EventChannel<P>` layer — just `IpcController` + per-channel `ipcMain.handle()`, wired up in `registerControllers()`.

## UI Decoupling Plan

Moving business logic from the renderer into main-process Controllers so a future UI swap only replaces the thin API services; shared request/response types go in `src/common/api/contracts/`. Phases 1–3 (Warcraft detection, installation CRUD, TOC parsing) are done; 4–6 (scan/sync, install/remove, `ipc-events.ts` cleanup) are not started. `wowup-electron/UI_DECOUPLING_PLAN.md` is the source of truth — update its checkboxes as phases complete.

## Shell + Bundle

`wowup-electron/SHELL_BUNDLE_PLAN.md` tracks splitting the app into a signed shell (`wowup-shell/`) plus a separately-signed, downloadable bundle so most releases don't need a new signed binary (finished-phase details: `SHELL_BUNDLE_HISTORY.md`). App code resolves its files through `app/bundle-paths.ts`, never `app.getAppPath()`/`__dirname` (lint enforces this). `electron-log`, `electron-updater` and `win-ca` are installed only in `wowup-shell`; the app resolves them via tsconfig `paths` and `NODE_PATH`.

## Build & Run

`wowup-electron` depends on local `wowup-lib-core` and on `wowup-shell`, so install those first:

```bash
cd wowup-lib && npm install && npm run build
cd ../wowup-shell && npm install          # also builds the native addon
cd ../wowup-electron && npm install && npm run build:lib
npm start          # wago flavor (builds bundle + shell, runs ../wowup-shell with --bundle-dir)
npm run ow:start   # Overwolf flavor
```

Installers: `npm run build:prod` (or `ow:build:prod`) in `wowup-electron`, then e.g. `npm run electron:publish:local` (or `ow:electron:publish:local`) in `wowup-shell`.

- Lint: `npm run lint` / Test: `npm test` (both in `wowup-electron/` and `wowup-shell/`)
- Format: `npm run pretty` (`wowup-electron/`), Prettier throughout; strict TypeScript.

## Branching & Commits

- Integrate all work on `develop`; **target PRs at `develop`** (`gh pr create --base develop` — GitHub's default is still `master`; PRs against `master` just need retargeting).
- `master` is release/stable: only `release/X.Y.Z` branches (cut from `develop`) merge into it, then `master` is merged back into `develop`.
- Commit messages: present tense, imperative, under 72 chars ("Add raiderio provider").

## Context Hygiene

- Large files (`addon.service.ts`, `my-addons.component.ts`, `app/main.ts`): grep first, then read line ranges.
- When checking UI, prefer `get_page_text` / `read_page` over screenshots; when a screenshot is needed, use `scale` 0.5 or lower.
