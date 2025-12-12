/**
 * Fingerprint Controller using IpcRouter
 *
 * Provides REST-like API endpoints for addon fingerprint scanning.
 * This controller delegates to FingerprintService to scan addon folders
 * and identify installed addons using both WowUp and CurseForge systems.
 */

import { BrowserWindow } from "electron";
import { IpcRouter } from "../ipc-router";
import { FingerprintService } from "../services/fingerprint-service";
import { AddonFolder } from "wowup-lib-core";
import * as log from "electron-log/main";

/**
 * Create and configure the fingerprint API routes
 *
 * @param window - The BrowserWindow instance
 * @returns Configured IpcRouter instance
 */
export function createFingerprintController(window: BrowserWindow): IpcRouter {
  const router = new IpcRouter("/api/fingerprint");
  const fingerprintService = new FingerprintService();

  // Middleware: Log all requests
  router.use(async (req, res, next) => {
    log.info(`[FingerprintAPI] ${req.method} ${req.path}`);
    await next();
  });

  /**
   * POST /api/fingerprint/scan
   *
   * Scans addon folders and enriches them with fingerprint data.
   *
   * Request body:
   * {
   *   addonFolders: AddonFolder[] - Array of addon folders to scan
   * }
   *
   * Response:
   * AddonFolder[] - Array of addon folders enriched with scan results
   */
  router.post("/scan", async (req, res) => {
    const { addonFolders } = req.body;

    // Validate input
    if (!addonFolders || !Array.isArray(addonFolders)) {
      return res.error("addonFolders array required", 400);
    }

    try {
      const enrichedFolders = await fingerprintService.getFingerprints(addonFolders);
      return res.success(enrichedFolders);
    } catch (error) {
      log.error("Fingerprint scan failed", error);
      return res.error(error.message, 500);
    }
  });

  return router;
}

/**
 * Example usage in renderer:
 *
 * ```typescript
 * import { IpcRouterClientService } from '../ipc-router/ipc-router-client.service';
 *
 * const enrichedFolders = await ipcClient.post<AddonFolder[]>(
 *   '/api/fingerprint/scan',
 *   { addonFolders }
 * );
 * ```
 */
