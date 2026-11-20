import { randomUUID } from "crypto";
import { app, BrowserWindow, net, powerMonitor } from "electron";
import * as Store from "electron-store";
import * as log from "electron-log/main";
import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";

import { AddonController } from "./addon.controller";
import { AddonProviderController } from "./addon-provider.controller";
import { AddonProviderRegistry } from "../services/addon-providers/addon-provider-registry";
import { AddonInstallController } from "./addon-install.controller";
import { AddonSyncController } from "./scan/addon-sync.controller";
import { AddonInstallService } from "../services/addons/addon-install.service";
import { AddonInstaller } from "../services/addons/addon-installer";
import { UserProviderState } from "../services/addon-providers/addon-provider-registry";
import { downloadFile } from "../services/download/file-download";
import { AddonRepository } from "../services/addons/addon-repository";
import { AddonSyncService } from "../services/addons/addon-sync.service";
import { copyPath, getLastModifiedFileDate, remove, unzipFile, zipFile } from "../file.utils";
import { AddonFolderService } from "../services/warcraft/addon-folder.service";
import {
  ADDON_PROVIDERS_KEY,
  IPC_ADDON_SCAN_EVENT,
  SETTINGS_SYNC_AUTO_KEY,
  SETTINGS_SYNC_CODE_KEY,
  SETTINGS_SYNC_FOLDER_KEY,
  SETTINGS_SYNC_INSTALLATIONS_KEY,
  USE_SYMLINK_MODE_PREFERENCE_KEY,
} from "../../src/common/constants";
import { WagoAdsController } from "./wago-ads.controller";
import { IpcController } from "./ipc-controller";
import { AppController } from "./app.controller";
import { FileSystemController } from "./file-system.controller";
import { MenuController } from "./menu.controller";
import { PushController } from "./push.controller";
import { WindowController } from "./window.controller";
import { FileSystemService } from "../services/files/file-system.service";
import { takePendingOpenUrls } from "../pending-open-urls";
import { MetricsController } from "./metrics/metrics.controller";
import { TocController } from "./toc/toc.controller";
import { SettingsSyncController } from "./sync/settings-sync.controller";
import { SettingsSyncConfig, SettingsSyncService } from "../services/sync/settings-sync.service";
import { FolderTransport } from "../services/sync/sync-transport";
import { isWowRunning } from "../services/sync/wow-process";
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
import { getInstallId } from "../preferences";
import { wagoHandler } from "../wago-handler";

export interface ControllerDeps {
  window: BrowserWindow;
  addonStore: Store;
  preferenceStore: Store;
  sensitiveStore: Store;
}

async function listDirectories(dirPath: string): Promise<string[]> {
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

/** Names of the `.toc` files directly in a folder; none if the folder isn't there */
async function listTocFiles(dirPath: string): Promise<string[]> {
  if (!(await pathExists(dirPath))) {
    return [];
  }
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".toc")).map((entry) => entry.name);
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
  const fileSystemService = new FileSystemService(log);
  const addonFolderService = new AddonFolderService(tocService, fileSystemService);

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
    getProviders: () => providerController.registry,
    onScanEvent: (event) => {
      if (!deps.window.isDestroyed()) {
        deps.window.webContents.send(IPC_ADDON_SCAN_EVENT, event);
      }
    },
    log,
  });

  // Where addon zips are downloaded to, and the only folder an install unzips from
  const downloadsFolderPath = path.join(app.getPath("userData"), "downloads");
  const removeFile = async (filePath: string) => {
    if (await pathExists(filePath)) {
      await remove(filePath);
    }
  };

  const installService = new AddonInstallService({
    repository: addonRepository,
    getInstallations: () => installationService.getAll(),
    getAddonFolderPath: (installation) => addonFolderService.getAddonFolderPath(installation),
    getAllTocs: (baseDir, folderNames, clientType) => tocService.getAllTocs(baseDir, folderNames, clientType),
    downloadsFolderPath,
    fs: {
      pathExists,
      listDirectories,
      copy: (sourcePath, destinationPath) => copyPath(sourcePath, destinationPath),
      remove: removeFile,
      unzip: (zipFilePath, outputFolder) => unzipFile(zipFilePath, outputFolder),
    },
    newId: () => randomUUID(),
    now: () => new Date(),
    log,
  });

  const installer = new AddonInstaller({
    getProviders: () => providerController.registry,
    installService,
    applySync: (request) => syncService.applySync(request),
    download: (options) => downloadFile(options, { net, log }),
    getInstallations: () => installationService.getAll(),
    getAddonFolderPath: (installation) => addonFolderService.getAddonFolderPath(installation),
    getFingerprints: (request) => scanService.scanFolders(request),
    downloadsFolderPath,
    removeFile,
    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log,
  });

  // The overwolf flavor renders its ad through the overwolf sdk.
  const adView = AppEnv.buildFlavor === "wago" ? new WagoAdViewService(deps.window) : undefined;

  const providerController = new AddonProviderController(
    (config) =>
      new AddonProviderRegistry({
        config,
        // Chromium's network stack, so proxies and certificates work as they did for the renderer
        fetch: (url, init) => net.fetch(url, init),
        installId: getInstallId(),
        platform: process.platform,
        getAddonFolderPath: (installation) => addonFolderService.getAddonFolderPath(installation),
        listTocFiles,
        parseToc: (tocPath) => tocService.parse(tocPath),
        getLatestDirUpdateTime: (dirPath) => getLastModifiedFileDate(dirPath),
        newId: () => randomUUID(),
        getSecret: (key) => deps.sensitiveStore.get(key),
        onSecretChange: (key, listener) => deps.sensitiveStore.onDidChange(key, (value) => listener(value)),
        onWagoToken: (listener) => wagoHandler.onToken(listener),
        onPowerResume: (listener) => {
          powerMonitor.on("resume", listener);
          return () => powerMonitor.off("resume", listener);
        },
        reloadAd: () => adView?.reload(),
        // The renderer saves these (WowUpService.setAddonProviderState); main only reads them
        getUserProviderStates: () => (deps.preferenceStore.get(ADDON_PROVIDERS_KEY) as UserProviderState[]) ?? [],
        log,
      }),
  );

  const settingsSyncService = new SettingsSyncService({
    getConfig: (): SettingsSyncConfig => ({
      code: deps.sensitiveStore.get(SETTINGS_SYNC_CODE_KEY) as string | undefined,
      folderPath: deps.preferenceStore.get(SETTINGS_SYNC_FOLDER_KEY) as string | undefined,
      autoSync: String(deps.preferenceStore.get(SETTINGS_SYNC_AUTO_KEY)) === "true",
      installationIds: (deps.preferenceStore.get(SETTINGS_SYNC_INSTALLATIONS_KEY) as string[] | undefined) ?? [],
    }),
    saveConfig: (config) => {
      const save = (store: Store, key: string, value: unknown) =>
        value === undefined ? store.delete(key) : store.set(key, value);
      if ("code" in config) save(deps.sensitiveStore, SETTINGS_SYNC_CODE_KEY, config.code);
      if ("folderPath" in config) save(deps.preferenceStore, SETTINGS_SYNC_FOLDER_KEY, config.folderPath);
      // Saved as a string, like every scalar preference
      if ("autoSync" in config) save(deps.preferenceStore, SETTINGS_SYNC_AUTO_KEY, String(config.autoSync));
      if ("installationIds" in config)
        save(deps.preferenceStore, SETTINGS_SYNC_INSTALLATIONS_KEY, config.installationIds);
    },
    getInstallations: () => installationService.getAll(),
    getTransport: (folderPath) => new FolderTransport(folderPath),
    getAddons: (installationId) =>
      addonRepository
        .getAllForInstallation(installationId)
        .filter((addon) => addon.isIgnored !== true && !!addon.externalId)
        .map((addon) => ({
          id: addon.externalId,
          name: addon.name,
          provider_name: addon.providerName,
          version_id: addon.installedExternalReleaseId ?? undefined,
        })),
    // Same folder and naming as the WTF backup dialog, so these backups can be restored from there
    createBackup: async (installation, wtfPath) => {
      const backupFolder = path.join(app.getPath("userData"), "wtf_backups", installation.id);
      await fsp.mkdir(backupFolder, { recursive: true });
      const zipPath = path.join(backupFolder, `wtf_${Date.now()}.zip`);
      await zipFile(wtfPath, zipPath);
      return zipPath;
    },
    isGameRunning: () => isWowRunning(),
    stateFolderPath: path.join(app.getPath("userData"), "settings-sync"),
    deviceId: getInstallId(),
    deviceName: os.hostname().replace(/\.local$/, ""),
    now: () => Date.now(),
    log,
  });

  const controllers: IpcController[] = [
    new AddonController(addonRepository),
    providerController,
    new AddonInstallController(installer, installService),
    new WarcraftController(getPlatformImpl(), deps.preferenceStore, addonFolderService),
    new WarcraftInstallationController(installationService),
    new TocController(tocService),
    new SettingsSyncController(deps.window, settingsSyncService),
    new AddonSyncController(syncService, () => metricsService.logRendererMemory("renderers after scan")),
    // Registered on every flavor on purpose: a resource report is only actionable if the ow numbers
    // can be held against the wago ones.
    new MetricsController(metricsService),
    new AppController(takePendingOpenUrls, log),
    new WindowController(deps.window, deps.preferenceStore),
    new MenuController(deps.window),
    new FileSystemController(fileSystemService, log),
    new PushController(),
  ];

  // The overwolf flavor renders its ad through the overwolf sdk.
  if (adView) {
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
