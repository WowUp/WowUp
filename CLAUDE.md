# WowUp Monorepo — Developer Architecture & Style Guide

WowUp is a World of Warcraft addon manager. This monorepo separates platform targets, core business logic, and shared TypeScript libraries.

---

## 📂 Repository Structure

| Package | Tech Stack | Purpose |
| :--- | :--- | :--- |
| [`wowup-electron/`](file:///d:/GitHub/WowUp-Dev/wowup-electron) | Electron 40 + Angular 17 | The main desktop client application (Active/Primary). |
| [`wowup-lib/`](file:///d:/GitHub/WowUp-Dev/wowup-lib) | TypeScript + Parcel | Shared core library (`wowup-lib-core`) consumed by the Electron app. |
| [`v3/`](file:///d:/GitHub/WowUp-Dev/v3) | TypeScript | Next-generation client version (In early development). |

---

## 🏛️ Baseline Architecture (Coupled UI, mid-migration)

The application still runs a **coupled renderer architecture** where Node capabilities are fully integrated into the browser process, but a UI-decoupling migration (below) is actively moving domain logic into the main process one vertical slice at a time:

- **Node Integration Enabled**: `nodeIntegration: true` and `contextIsolation: false` are configured in `app/main.ts`. The Angular UI imports Node native APIs (`fs`, `path`, etc.) directly.
- **Business Logic in Renderer (not yet migrated)**:
  - Addon Providers (`src/app/addon-providers/`) execute all HTTP calls and metadata scraping in the browser context.
  - TOC parsing, addon scan/sync, and install/remove (`src/app/services/addons/`) still run on the Angular side.
- **Main Process (`app/`)**: Was a thin window manager routed through the legacy [`app/ipc-events.ts`](file:///d:/GitHub/WowUp-Dev/wowup-electron/app/ipc-events.ts) registry; now also hosts a growing set of **Controllers** (`app/controllers/`, implementing `IpcController`, registered in `app/controllers/index.ts`) and main-process **services** (`app/services/`) for logic that has already been migrated — e.g. Warcraft platform/executable detection (`WarcraftController`).
- **Renderer API wrappers**: Migrated domains get a thin Angular service under `src/app/services/api/` (e.g. `warcraft-api.service.ts`) that just wraps `ipcRenderer.invoke()` for the new IPC channels — no business logic.

---

## 🚀 UI Decoupling Plan (in progress)

Goal: move business logic out of the Angular renderer into the Electron main process so a future UI swap (e.g. React) only has to replace thin API-wrapper services. Each domain becomes a Controller in `app/controllers/` exposed via `ipcMain.handle()`; the renderer gets a thin API service in `src/app/services/api/`; shared request/response types will live in `src/common/api/contracts/`.

Full phase-by-phase checklist: [`wowup-electron/UI_DECOUPLING_PLAN.md`](file:///d:/GitHub/WowUp-Dev/wowup-electron/UI_DECOUPLING_PLAN.md) — keep that file, not this section, as the source of truth for what's done vs. pending; update its checkboxes as phases complete.

Status snapshot:
1. **Phase 1 — Warcraft Platform Detection**: ✅ done. `WarcraftPlatform` (`app/services/warcraft/`) + `WarcraftController` + `warcraft-api.service.ts`; old `warcraft.service.{impl,win,mac,linux}.ts` deleted from the renderer.
2. **Phase 2 — Warcraft Installation CRUD**: ✅ done. `WarcraftInstallationController` (`app/controllers/warcraft/`) + `warcraft-installation-api.service.ts`; `WarcraftInstallationService` now delegates CRUD/storage to the controller and only keeps Angular-specific state (RxJS broadcast, `TranslateService` display names).
3. **Phases 3–6 — TOC parsing/addon folder listing, addon scan/sync, install/remove pipeline, `ipc-events.ts` cleanup**: ⏳ not started.

Note: there is no `Procedure<I, O>` / `EventChannel<P>` primitive layer — the actual pattern is the simpler `IpcController` interface + per-channel `ipcMain.handle()` calls, wired up in `registerControllers()`.

---

## 🛠️ Operations & Execution Playbook

### Build Order Requirement
Because `wowup-electron` depends on the local `wowup-lib-core` package, **`wowup-lib` must be compiled first**.

```bash
# 1. Compile the shared library
cd wowup-lib
npm install
npm run build

# 2. Setup the Electron workspace
cd ../wowup-electron
npm install
npm run build:lib  # Syncs and links the shared library locally

# 3. Serve the application
npm start          # Serve default flavor (wago)
npm run ow:start   # Serve Overwolf flavor (ow)
```

### Common Commands (wowup-electron/)
- **Lint Code**: `npm run lint`
- **Run Tests**: `npm test`
- **Format Code**: `npm run pretty`

---

## 📝 Branching & Style Guidelines

- **Branching Policy**:
  - Primary development branch: `master`.
  - Release branches: `release/X.Y.Z`.
  - Target all PRs at `master` unless explicitly working on a specific release.
- **Code Formatting**:
  - TypeScript strictly throughout the workspace.
  - Formatted via Prettier (`npx prettier --write .`).
- **Commit Messages**:
  - Present tense, imperative mood, under 72 characters (e.g. *"Add raiderio provider"* not *"Added raiderio provider"*).
