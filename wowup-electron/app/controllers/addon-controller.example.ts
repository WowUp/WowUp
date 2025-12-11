/**
 * Example: Addon Controller using IpcRouter
 *
 * This demonstrates how to create a REST-like API controller
 * for managing addons using the IpcRouter system.
 */

import { BrowserWindow } from "electron";
import { IpcRouter } from "../ipc-router";
import { getAddonStore } from "../stores";
import * as log from "electron-log/main";

/**
 * Create and configure the addon API routes
 */
export function createAddonController(window: BrowserWindow): IpcRouter {
  const router = new IpcRouter("/api/addons");

  // Middleware example: Log all requests
  router.use(async (req, res, next) => {
    log.info(`[AddonAPI] ${req.method} ${req.path}`);
    await next();
  });

  // Middleware example: Validate addon store exists
  router.use(async (req, res, next) => {
    const store = getAddonStore();
    if (!store) {
      throw new Error("Addon store not initialized");
    }
    await next();
  });

  // GET /api/addons/list - Get all addons
  router.get("/list", async (req, res) => {
    const store = getAddonStore();
    const addons = store?.store ?? {};

    return res.success({
      addons: Object.values(addons),
      count: Object.keys(addons).length,
    });
  });

  // GET /api/addons/:id - Get single addon by ID
  router.get("/:id", async (req, res) => {
    const { id } = req.params;
    const store = getAddonStore();
    const addon = store?.get(id);

    if (!addon) {
      return res.error(`Addon not found: ${id}`, 404);
    }

    return res.success(addon);
  });

  // POST /api/addons - Create/save a new addon
  router.post("/", async (req, res) => {
    const addon = req.body;

    if (!addon.id) {
      return res.error("Addon ID is required", 400);
    }

    const store = getAddonStore();
    store?.set(addon.id, addon);

    return res.success({
      message: "Addon saved successfully",
      addon,
    });
  });

  // PUT /api/addons/:id - Update an existing addon
  router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const store = getAddonStore();
    const existing = store?.get(id);

    if (!existing) {
      return res.error(`Addon not found: ${id}`, 404);
    }

    const updated = { ...existing, ...updates, id }; // Ensure ID doesn't change
    store?.set(id, updated);

    return res.success({
      message: "Addon updated successfully",
      addon: updated,
    });
  });

  // DELETE /api/addons/:id - Delete an addon
  router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    const store = getAddonStore();

    if (!store?.has(id)) {
      return res.error(`Addon not found: ${id}`, 404);
    }

    store.delete(id);

    return res.success({
      message: "Addon deleted successfully",
      id,
    });
  });

  // POST /api/addons/batch-save - Save multiple addons
  router.post("/batch-save", async (req, res) => {
    const { addons } = req.body;

    if (!Array.isArray(addons)) {
      return res.error("Addons must be an array", 400);
    }

    const store = getAddonStore();
    let saved = 0;
    let failed = 0;

    for (const addon of addons) {
      if (typeof addon.id === "string") {
        store?.set(addon.id, addon);
        saved++;
      } else {
        failed++;
        log.warn("Malformed addon not saved", addon);
      }
    }

    return res.success({
      message: "Batch save completed",
      saved,
      failed,
    });
  });

  // GET /api/addons/search - Search addons with query params
  router.get("/search", async (req, res) => {
    const { name, provider } = req.query;
    const store = getAddonStore();
    const allAddons = Object.values(store?.store ?? {});

    let results = allAddons;

    if (name) {
      results = results.filter((addon: any) =>
        addon.name?.toLowerCase().includes(name.toLowerCase())
      );
    }

    if (provider) {
      results = results.filter((addon: any) => addon.providerName === provider);
    }

    return res.success({
      results,
      count: results.length,
      query: { name, provider },
    });
  });

  return router;
}

/**
 * Example usage in main.ts:
 *
 * ```typescript
 * import { createAddonController } from './controllers/addon-controller.example';
 *
 * // In your initializeIpcHandlers function:
 * const addonController = createAddonController(window);
 * addonController.register(window);
 * ```
 *
 * Example renderer side usage:
 *
 * ```typescript
 * import { createIpcClient } from '../app/ipc-router';
 *
 * const api = createIpcClient();
 *
 * // Get all addons
 * const { addons } = await api.get('/api/addons/list');
 *
 * // Get single addon
 * const addon = await api.get('/api/addons/123');
 *
 * // Create addon
 * const result = await api.post('/api/addons', {
 *   id: '123',
 *   name: 'My Addon',
 *   version: '1.0.0'
 * });
 *
 * // Update addon
 * const updated = await api.put('/api/addons/123', {
 *   version: '1.0.1'
 * });
 *
 * // Delete addon
 * await api.delete('/api/addons/123');
 *
 * // Search addons
 * const { results } = await api.get('/api/addons/search', {
 *   name: 'questie',
 *   provider: 'Curse'
 * });
 *
 * // Batch save
 * await api.post('/api/addons/batch-save', {
 *   addons: [addon1, addon2, addon3]
 * });
 * ```
 */
