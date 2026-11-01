import { app, BrowserWindow, ipcMain } from "electron";
import * as log from "electron-log/main";
import { autoUpdater } from "electron-updater";
import { getShell } from "../../wowup-shell/contract/shell-api";
import {
  IPC_APP_CHECK_UPDATE,
  IPC_APP_INSTALL_UPDATE,
  IPC_APP_UPDATE_STATE,
  IPC_BUNDLE_UPDATE_GET,
  IPC_BUNDLE_UPDATE_READY,
  IPC_BUNDLE_UPDATE_RESTART,
} from "../src/common/constants";
import {
  AppUpdateDownloadProgress,
  AppUpdateEvent,
  AppUpdateState,
  BundleUpdateEvent,
} from "../src/common/wowup/models";
import { WowUpReleaseChannelType } from "../src/common/wowup/wowup-release-channel-type";
import { getWowUpReleaseChannelPreference } from "./preferences";

/** How long "Later" can put off restarting into a downloaded bundle, so few installs stay on old versions */
const BUNDLE_RESTART_DEADLINE_MS = 6 * 60 * 60 * 1000;
const BUNDLE_DEADLINE_CHECK_MS = 60 * 1000;

/** The bundle channel the shell checks for each release channel preference */
function getBundleChannel(channel: WowUpReleaseChannelType): string {
  return channel === WowUpReleaseChannelType.Beta ? "beta" : "stable";
}

// Two updaters: electron-updater replaces the signed shell (installer releases), and the shell's own updater
// downloads newer app bundles, which load on the next start. See SHELL_BUNDLE_PLAN.md.
class AppUpdater {
  private _win: BrowserWindow;
  private _bundleUpdate: BundleUpdateEvent | undefined;
  private _bundleRestartDeadline: number | undefined;

  public dispose(): void {}

  public init(win: BrowserWindow) {
    this._win = win;
    this.initUpdater();
    this.initBundleUpdates();
    this.initIpcHandlers();
  }

  public async checkForUpdates(): Promise<void> {
    try {
      const result = await autoUpdater.checkForUpdates();
      log.info(`checkForUpdates`, result);
    } catch (e) {
      log.error("checkForUpdates", e);
    }
  }

  private initIpcHandlers() {
    ipcMain.on(IPC_APP_CHECK_UPDATE, () => {
      this.checkForUpdates().catch((e) => console.error(e));
      getShell()
        .updates.checkNow()
        .catch((e) => console.error(e));
    });

    // The renderer may load after the shell says an update is ready
    ipcMain.handle(IPC_BUNDLE_UPDATE_GET, () => this._bundleUpdate ?? null);

    ipcMain.on(IPC_BUNDLE_UPDATE_RESTART, () => {
      getShell().updates.restart();
    });

    // Used this solution for Mac support
    // https://github.com/electron-userland/electron-builder/issues/1604#issuecomment-372091881
    ipcMain.on(IPC_APP_INSTALL_UPDATE, () => {
      app.removeAllListeners("window-all-closed");
      const browserWindows = BrowserWindow.getAllWindows();
      browserWindows.forEach(function (browserWindow) {
        browserWindow.removeAllListeners("close");
      });
      autoUpdater.quitAndInstall();
    });

    ipcMain.handle("set-release-channel", (evt, channel: WowUpReleaseChannelType) => {
      autoUpdater.allowPrerelease = channel === WowUpReleaseChannelType.Beta;
      log.info(`set-release-channel: allowPreRelease = ${autoUpdater.allowPrerelease.toString()}`);
      getShell().updates.setChannel(getBundleChannel(channel));
    });
  }

  private initBundleUpdates() {
    const updates = getShell().updates;
    updates.onReady((update) => {
      // The clock starts with the first update; a newer one arriving meanwhile doesn't reset it
      if (this._bundleRestartDeadline === undefined) {
        this._bundleRestartDeadline = Date.now() + BUNDLE_RESTART_DEADLINE_MS;
      }
      const overdue = this._bundleUpdate?.overdue === true;
      this.sendBundleUpdate({ version: update.version, important: update.important || overdue, overdue });
    });
    updates.setChannel(getBundleChannel(getWowUpReleaseChannelPreference()));

    // Checked against the wall clock rather than with one long timer, which sleep and hibernation would stretch
    setInterval(() => this.checkBundleRestartDeadline(), BUNDLE_DEADLINE_CHECK_MS);
  }

  /** Once the deadline passes, the renderer asks again, and this time the restart can't be put off */
  private checkBundleRestartDeadline() {
    const update = this._bundleUpdate;
    if (update === undefined || update.important || Date.now() < (this._bundleRestartDeadline ?? Infinity)) {
      return;
    }
    log.info(`Bundle ${update.version} was put off past the restart deadline, requiring a restart`);
    this.sendBundleUpdate({ ...update, important: true, overdue: true });
  }

  private sendBundleUpdate(update: BundleUpdateEvent) {
    this._bundleUpdate = update;
    this._win?.webContents?.send(IPC_BUNDLE_UPDATE_READY, update);
  }

  private initUpdater() {
    autoUpdater.logger = log;
    autoUpdater.autoDownload = true;
    autoUpdater.allowPrerelease = getWowUpReleaseChannelPreference() === WowUpReleaseChannelType.Beta;

    autoUpdater.on("checking-for-update", () => {
      log.info("autoUpdater checking-for-update");
      const evt: AppUpdateEvent = {
        state: AppUpdateState.CheckingForUpdate,
      };

      this._win?.webContents?.send(IPC_APP_UPDATE_STATE, evt);
    });

    autoUpdater.on("update-available", (info) => {
      log.info("autoUpdater update-available", info);
      const evt: AppUpdateEvent = {
        state: AppUpdateState.UpdateAvailable,
      };

      this._win?.webContents?.send(IPC_APP_UPDATE_STATE, evt);
    });

    autoUpdater.on("update-not-available", (info) => {
      log.info("autoUpdater update-not-available", info);
      const evt: AppUpdateEvent = {
        state: AppUpdateState.UpdateNotAvailable,
      };

      this._win?.webContents?.send(IPC_APP_UPDATE_STATE, evt);
    });

    autoUpdater.on("download-progress", (progressObj: AppUpdateDownloadProgress) => {
      const evt: AppUpdateEvent = {
        state: AppUpdateState.Downloading,
        progress: { ...progressObj },
      };

      this._win?.webContents?.send(IPC_APP_UPDATE_STATE, evt);
    });

    autoUpdater.on("update-downloaded", () => {
      log.info("autoUpdater update-downloaded");
      const evt: AppUpdateEvent = {
        state: AppUpdateState.Downloaded,
      };

      this._win?.webContents?.send(IPC_APP_UPDATE_STATE, evt);
    });

    autoUpdater.on("error", (e) => {
      log.error("autoUpdater error", e);
      const evt: AppUpdateEvent = {
        state: AppUpdateState.Error,
        error: e.toString(),
      };

      this._win?.webContents?.send(IPC_APP_UPDATE_STATE, evt);
    });
  }
}

export const appUpdater = new AppUpdater();
