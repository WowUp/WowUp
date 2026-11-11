import { randomUUID } from "crypto";
import { app, BrowserWindow } from "electron";
import * as Store from "electron-store";
import * as log from "electron-log/main";
import * as fsp from "fs/promises";
import * as path from "path";

import { AddonController } from "./addon.controller";
import { AddonInstallController } from "./addon-install.controller";
import { AddonSyncController } from "./scan/addon-sync.controller";
import { AddonInstallService } from "../services/addons/addon-install.service";
import { AddonRepository } from "../services/addons/addon-repository";
import { AddonSyncService } from "../services/addons/addon-sync.service";
import { copyPath, getLastModifiedFileDate, remove, unzipFile } from "../file.utils";
import { AddonFolderService } from "../services/warcraft/addon-folder.service";
import { USE_SYMLINK_MODE_PREFERENCE_KEY } from "../../src/common/constants";
import { WagoAdsController } from "./wago-ads.controller";
import { IpcController } from "./ipc-controller";
import { MetricsController } from "./metrics/metrics.controller";
import { AddonFingerprintController } from "./scan/addon-fingerprint.controller";
import { TocController } from "./toc/toc.controller";
import { WarcraftController } from "./warcraft/warcraft.controller";
import { WarcraftInstallationController } from "./warcraft/warcraft-installation.controller";
import { TocService } from "../services/toc/toc.service";
import { WagoAdViewService } from "../services/ads/wago-ad-view.service";
import { WagoCmpWindowService } from "../services/ads/wago-cmp-window.service";
import { ProcessMetricsService } from "../services/metrics/process-metrics";
import { getWebContentsLabels } from "../services/metrics/web-contents-labels";
import { sampleWindow } from "../services/metrics/window-sample";
import { AddonScanService } from "../services/scan/addon-scan.service";
import { nodeHashAlgorithms } from "../services/scan/hash-algorithms";
import { WarcraftInstallationService } from "../services/warcraft/warcraft-installation.service";
import { WarcraftPlatformWin } from "../services/warcraft/warcraft-platform.win";
import { WarcraftPlatformMac } from "../services/warcraft/warcraft-platform.mac";
import { WarcraftPlatformLinux } from "../services/warcraft/warcraft-platform.linux";
import { WarcraftPlatform } from "../services/warcraft/warcraft-platform.service";
import { AppEnv } from "../env/environment";
import * as platform from "../platform";

export interface ControllerDeps {
  window: BrowserWindow;
  addonStore: Store;
  preferenceStore: Store;
}

async function listDirectories(dirPath: string): Promise<string[]> {
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

/** Unlike file.utils' `exists`, says nothing when the path isn't there: that's the usual answer here */
async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getPlatformImpl(): WarcraftPlatform {
  if (platform.isWin) return new WarcraftPlatformWin();
  if (platform.isMac) return new WarcraftPlatformMac();
  if (platform.isLinux) return new WarcraftPlatformLinux();
  throw new Error("Unsupported platform");
}

/**
 * Composition root for the main process.
 *
 * Controllers are ipc adapters and nothing else: everything they need is built here and handed to
 * them, so what talks to what is answerable by reading this function. Note that this runs per
 * window, not once per app — `createWindow` can run again — so anything built here lives and dies
 * with that window.
 */
export function registerControllers(deps: ControllerDeps): void {
  const tocService = new TocService();

  const metricsService = new ProcessMetricsService({
    getAppMetrics: () => app.getAppMetrics(),
    getWindowSample: () => sampleWindow(deps.window),
    getProcessLabels: () => getWebContentsLabels(),
    flavor: AppEnv.buildFlavor,
    log,
  });

  const addonRepository = new AddonRepository(deps.addonStore);
  const installationService = new WarcraftInstallationService(deps.preferenceStore);
  const scanService = new AddonScanService({ hashes: nodeHashAlgorithms, log });
  const addonFolderService = new AddonFolderService(tocService);

  const syncService = new AddonSyncService({
    repository: addonRepository,
    getInstallations: () => installationService.getAll(),
    getAddonFolderPath: (installation) => addonFolderService.getAddonFolderPath(installation),
    listAddons: (addonFolderPath, scanSymlinks) => addonFolderService.listAddons(addonFolderPath, scanSymlinks),
    // Saved as the string "true"/"false", like every scalar preference
    getScanSymlinks: () => String(deps.preferenceStore.get(USE_SYMLINK_MODE_PREFERENCE_KEY)) === "true",
    // Only the overwolf flavor has curseforge, the one provider that matches on its own fingerprint
    fingerprintSources: AppEnv.buildFlavor === "ow" ? ["wowup", "curseforge"] : ["wowup"],
    listDirectories,
    getFingerprints: (request) => scanService.scanFolders(request),
    getLatestDirUpdateTime: (dirPath) => getLastModifiedFileDate(dirPath),
    newId: () => randomUUID(),
    log,
  });

  const installService = new AddonInstallService({
    repository: addonRepository,
    getInstallations: () => installationService.getAll(),
    getAddonFolderPath: (installation) => addonFolderService.getAddonFolderPath(installation),
    getAllTocs: (baseDir, folderNames, clientType) => tocService.getAllTocs(baseDir, folderNames, clientType),
    // Where the renderer's download service saves addon zips (WowUpService.applicationDownloadsFolderPath)
    downloadsFolderPath: path.join(app.getPath("userData"), "downloads"),
    fs: {
      pathExists,
      listDirectories,
      copy: (sourcePath, destinationPath) => copyPath(sourcePath, destinationPath),
      remove: async (filePath) => {
        if (await pathExists(filePath)) {
          await remove(filePath);
        }
      },
      unzip: (zipFilePath, outputFolder) => unzipFile(zipFilePath, outputFolder),
    },
    newId: () => randomUUID(),
    now: () => new Date(),
    log,
  });

  const controllers: IpcController[] = [
    new AddonController(addonRepository),
    new AddonInstallController(installService),
    new WarcraftController(getPlatformImpl(), deps.preferenceStore, addonFolderService),
    new WarcraftInstallationController(installationService),
    new TocController(tocService),
    new AddonFingerprintController(scanService),
    new AddonSyncController(syncService, () => metricsService.logRendererMemory("renderers after scan")),
    // Registered on every flavor on purpose: a resource report is only actionable if the ow numbers
    // can be held against the wago ones.
    new MetricsController(metricsService),
  ];

  // The overwolf flavor renders its ad through the overwolf sdk.
  if (AppEnv.buildFlavor === "wago") {
    const adView = new WagoAdViewService(deps.window);
    const cmpWindow = new WagoCmpWindowService(deps.window, (visible) => adView.setCmpOpen(visible));
    controllers.push(new WagoAdsController(deps.window, adView, cmpWindow));
  }

  for (const controller of controllers) {
    controller.register();
  }

  // One teardown path for the whole set, rather than each controller hand-rolling its own listener.
  deps.window.once("closed", () => {
    for (const controller of controllers) {
      try {
        controller.dispose?.();
      } catch (e) {
        log.error("[controllers] failed to dispose a controller", e);
      }
    }
  });
}
