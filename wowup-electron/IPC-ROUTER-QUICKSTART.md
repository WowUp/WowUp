# IPC Router - Quick Start Guide

Complete guide to setting up and using the REST-like IPC Router system in WowUp Electron.

## 📚 Table of Contents

1. [What is IPC Router?](#what-is-ipc-router)
2. [Main Process Setup](#main-process-setup)
3. [Angular Client Setup](#angular-client-setup)
4. [Complete Example](#complete-example)
5. [Key Files](#key-files)

---

## What is IPC Router?

A REST-like API system for Electron IPC that makes communication between main and renderer processes feel like working with a web API (Express.js style).

**Benefits:**
- 🎯 Familiar REST API pattern (GET, POST, PUT, DELETE)
- 📦 Better code organization (controllers instead of scattered handlers)
- 🔍 More discoverable (REST paths vs channel strings)
- 🛡️ Type-safe with TypeScript
- ⚡ Built-in middleware support
- ✅ Standardized error handling

---

## Main Process Setup

### Step 1: Create a Controller

Create `app/controllers/addon-controller.ts`:

```typescript
import { BrowserWindow } from "electron";
import { IpcRouter } from "../ipc-router";
import { getAddonStore } from "../stores";

export function createAddonController(window: BrowserWindow): IpcRouter {
  const router = new IpcRouter("/api/addons");

  // Middleware (optional)
  router.use(async (req, res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    await next();
  });

  // GET /api/addons/list
  router.get("/list", async (req, res) => {
    const store = getAddonStore();
    const addons = Object.values(store?.store ?? {});

    return res.success({
      addons,
      count: addons.length
    });
  });

  // GET /api/addons/:id
  router.get("/:id", async (req, res) => {
    const { id } = req.params;
    const store = getAddonStore();
    const addon = store?.get(id);

    if (!addon) {
      return res.error(`Addon not found: ${id}`, 404);
    }

    return res.success(addon);
  });

  // POST /api/addons
  router.post("/", async (req, res) => {
    const addon = req.body;

    if (!addon.id) {
      return res.error("Addon ID is required", 400);
    }

    const store = getAddonStore();
    store?.set(addon.id, addon);

    return res.success({ message: "Addon saved", addon });
  });

  // PUT /api/addons/:id
  router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const store = getAddonStore();
    const existing = store?.get(id);

    if (!existing) {
      return res.error(`Addon not found: ${id}`, 404);
    }

    const updated = { ...existing, ...updates, id };
    store?.set(id, updated);

    return res.success({ message: "Addon updated", addon: updated });
  });

  // DELETE /api/addons/:id
  router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    const store = getAddonStore();

    if (!store?.has(id)) {
      return res.error(`Addon not found: ${id}`, 404);
    }

    store.delete(id);
    return res.success({ message: "Addon deleted", id });
  });

  return router;
}
```

### Step 2: Register in main.ts

In `app/main.ts`, add to your `initializeIpcHandlers` function:

```typescript
import { createAddonController } from "./controllers/addon-controller";

export function initializeIpcHandlers(window: BrowserWindow): void {
  // ... existing handlers ...

  // Register REST-like API controllers
  const addonController = createAddonController(window);
  addonController.register(window);
}
```

---

## Angular Client Setup

### Step 1: Create an API Service

Create `src/app/services/addon-api.service.ts`:

```typescript
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { IpcRouterClientService } from "./ipc-router/ipc-router-client.service";
import { Addon } from "wowup-lib-core";

interface AddonListResponse {
  addons: Addon[];
  count: number;
}

@Injectable({
  providedIn: "root",
})
export class AddonApiService {
  constructor(private ipcClient: IpcRouterClientService) {}

  // Promise-based methods
  async getAllAddons(): Promise<AddonListResponse> {
    return await this.ipcClient.get<AddonListResponse>("/api/addons/list");
  }

  async getAddon(id: string): Promise<Addon> {
    return await this.ipcClient.get<Addon>(`/api/addons/${id}`);
  }

  async createAddon(addon: Addon): Promise<any> {
    return await this.ipcClient.post("/api/addons", addon);
  }

  async updateAddon(id: string, updates: Partial<Addon>): Promise<any> {
    return await this.ipcClient.put(`/api/addons/${id}`, updates);
  }

  async deleteAddon(id: string): Promise<any> {
    return await this.ipcClient.delete(`/api/addons/${id}`);
  }

  // Observable-based methods (for use with async pipe)
  getAllAddons$(): Observable<AddonListResponse> {
    return this.ipcClient.get$<AddonListResponse>("/api/addons/list");
  }

  getAddon$(id: string): Observable<Addon> {
    return this.ipcClient.get$<Addon>(`/api/addons/${id}`);
  }
}
```

### Step 2: Use in Your Component

```typescript
import { Component, OnInit } from '@angular/core';
import { AddonApiService } from '../services/addon-api.service';
import { Addon } from 'wowup-lib-core';

@Component({
  selector: 'app-addon-list',
  template: `
    <div *ngIf="loading">Loading...</div>
    <div *ngIf="error">Error: {{ error }}</div>

    <div *ngFor="let addon of addons">
      <h3>{{ addon.name }}</h3>
      <p>Version: {{ addon.version }}</p>
      <button (click)="updateVersion(addon)">Update</button>
      <button (click)="removeAddon(addon.id)">Delete</button>
    </div>
  `
})
export class AddonListComponent implements OnInit {
  addons: Addon[] = [];
  loading = false;
  error: string | null = null;

  constructor(private addonApi: AddonApiService) {}

  async ngOnInit() {
    await this.loadAddons();
  }

  async loadAddons() {
    this.loading = true;
    this.error = null;

    try {
      const response = await this.addonApi.getAllAddons();
      this.addons = response.addons;
      console.log(`Loaded ${response.count} addons`);
    } catch (error: any) {
      this.error = error.message;
      console.error('Failed to load addons:', error);
    } finally {
      this.loading = false;
    }
  }

  async updateVersion(addon: Addon) {
    try {
      await this.addonApi.updateAddon(addon.id, {
        version: '2.0.0'
      });
      await this.loadAddons(); // Reload
    } catch (error) {
      console.error('Failed to update:', error);
    }
  }

  async removeAddon(id: string) {
    try {
      await this.addonApi.deleteAddon(id);
      await this.loadAddons(); // Reload
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  }
}
```

### Step 3: Using with Observables (Alternative)

```typescript
import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { AddonApiService } from '../services/addon-api.service';

@Component({
  selector: 'app-addon-list-reactive',
  template: `
    <div *ngIf="addons$ | async as response">
      <p>Total: {{ response.count }}</p>
      <div *ngFor="let addon of response.addons">
        {{ addon.name }}
      </div>
    </div>
  `
})
export class AddonListReactiveComponent {
  addons$: Observable<any>;

  constructor(private addonApi: AddonApiService) {
    this.addons$ = this.addonApi.getAllAddons$();
  }
}
```

---

## Complete Example

### Main Process Controller

```typescript
// app/controllers/file-controller.ts
import { IpcRouter } from "../ipc-router";
import * as fsp from "fs/promises";

export function createFileController(): IpcRouter {
  const router = new IpcRouter("/api/files");

  router.post("/read", async (req, res) => {
    const { path } = req.body;
    const content = await fsp.readFile(path, "utf-8");
    return res.success({ content, path });
  });

  router.post("/write", async (req, res) => {
    const { path, content } = req.body;
    await fsp.writeFile(path, content, "utf-8");
    return res.success({ success: true, path });
  });

  router.get("/exists", async (req, res) => {
    const { path } = req.query;
    try {
      await fsp.access(path);
      return res.success({ exists: true, path });
    } catch {
      return res.success({ exists: false, path });
    }
  });

  return router;
}
```

### Angular Service

```typescript
// src/app/services/file-api.service.ts
import { Injectable } from "@angular/core";
import { IpcRouterClientService } from "./ipc-router/ipc-router-client.service";

@Injectable({ providedIn: "root" })
export class FileApiService {
  constructor(private ipcClient: IpcRouterClientService) {}

  async readFile(path: string): Promise<string> {
    const response = await this.ipcClient.post<{ content: string }>("/api/files/read", { path });
    return response.content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.ipcClient.post("/api/files/write", { path, content });
  }

  async fileExists(path: string): Promise<boolean> {
    const response = await this.ipcClient.get<{ exists: boolean }>("/api/files/exists", { path });
    return response.exists;
  }
}
```

### Component Usage

```typescript
// In your component
constructor(private fileApi: FileApiService) {}

async loadConfig() {
  const content = await this.fileApi.readFile("/app/config.json");
  const config = JSON.parse(content);
  return config;
}

async saveConfig(config: any) {
  const content = JSON.stringify(config, null, 2);
  await this.fileApi.writeFile("/app/config.json", content);
}
```

---

## Key Files

### Main Process
- **[app/ipc-router.ts](app/ipc-router.ts)** - Core IpcRouter class
- **[app/controllers/addon-controller.example.ts](app/controllers/addon-controller.example.ts)** - Example controller
- **[app/IPC-ROUTER.md](app/IPC-ROUTER.md)** - Complete main process documentation

### Angular Client
- **[src/app/services/ipc-router/ipc-router-client.service.ts](src/app/services/ipc-router/ipc-router-client.service.ts)** - Angular IPC client service
- **[src/app/services/ipc-router/addon-api.service.example.ts](src/app/services/ipc-router/addon-api.service.example.ts)** - Example API service
- **[src/app/services/ipc-router/README.md](src/app/services/ipc-router/README.md)** - Complete Angular documentation

---

## Common Patterns

### Error Handling

```typescript
// Main process
router.get("/:id", async (req, res) => {
  const item = await findItem(req.params.id);

  if (!item) {
    return res.error("Item not found", 404);
  }

  return res.success(item);
});

// Angular
async loadItem(id: string) {
  try {
    return await this.ipcClient.get(`/api/items/${id}`);
  } catch (error: any) {
    if (error.code === 404) {
      console.log("Item not found");
    }
    throw error;
  }
}
```

### Middleware

```typescript
// Logging
router.use(async (req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  await next();
});

// Validation
router.use(async (req, res, next) => {
  if (!req.body.id) {
    throw new Error("ID is required");
  }
  await next();
});
```

### Query Parameters

```typescript
// Main process
router.get("/search", async (req, res) => {
  const { name, type } = req.query;
  const results = await search({ name, type });
  return res.success(results);
});

// Angular
const results = await this.ipcClient.get("/api/addons/search", {
  name: "questie",
  type: "quest"
});
```

---

## Next Steps

1. ✅ Read the full [Main Process Documentation](app/IPC-ROUTER.md)
2. ✅ Read the full [Angular Client Documentation](src/app/services/ipc-router/README.md)
3. 🚀 Create your first controller
4. 🎯 Create your first Angular API service
5. 🧪 Test your implementation

**Questions?** Check the example files or the complete documentation!
