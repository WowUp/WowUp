import { app, BrowserWindow, ipcMain } from "electron";
import * as log from "electron-log/main";
import { autoUpdater } from "electron-updater";
import { IPC_APP_CHECK_UPDATE, IPC_APP_INSTALL_UPDATE, IPC_APP_UPDATE_STATE } from "../src/common/constants";
import { AppUpdateDownloadProgress, AppUpdateEvent, AppUpdateState } from "../src/common/wowup/models";
import { WowUpReleaseChannelType } from "../src/common/wowup/wowup-release-channel-type";
import { getWowUpReleaseChannelPreference } from "./preferences";

class AppUpdater {
  private _win: BrowserWindow;

  public dispose(): void {}

  public init(win: BrowserWindow) {
    this._win = win;
    this.initUpdater();
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
    });
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
