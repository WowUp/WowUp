import { app, BrowserWindow, ipcMain } from "electron";
import * as log from "electron-log";
import { autoUpdater } from "electron-updater";
import { IPC_APP_CHECK_UPDATE, IPC_APP_INSTALL_UPDATE, IPC_APP_UPDATE_STATE } from "../src/common/constants";
import { AppUpdateDownloadProgress, AppUpdateEvent, AppUpdateState } from "../src/common/wowup/models";

export class AppUpdater {
  private _win: BrowserWindow;

  public constructor(win: BrowserWindow) {
    this._win = win;
    this.initUpdater();
    this.initIpcHandlers();
  }

  public dispose(): void {}

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
  }

  private initUpdater() {
    autoUpdater.logger = log;
    autoUpdater.autoDownload = true;

    autoUpdater.on("checking-for-update", () => {
      log.info("autoUpdater checking-for-update");
      const evt: AppUpdateEvent = {
        state: AppUpdateState.CheckingForUpdate,
      };

      this._win?.webContents?.send(IPC_APP_UPDATE_STATE, evt);
    });

    autoUpdater.on("update-available", () => {
      log.info("autoUpdater update-available");
      const evt: AppUpdateEvent = {
        state: AppUpdateState.UpdateAvailable,
      };

      this._win?.webContents?.send(IPC_APP_UPDATE_STATE, evt);
    });

    autoUpdater.on("update-not-available", () => {
      log.info("autoUpdater update-not-available");
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

// export const checkForUpdates = async (win: BrowserWindow): Promise<UpdateCheckResult> => {
//   let result = undefined;
//   try {
//     win.webContents.send(APP_UPDATE_CHECK_START);
//     result = await autoUpdater.checkForUpdates();
//   } catch (e) {
//     console.error(e);
//   } finally {
//     win.webContents.send(APP_UPDATE_CHECK_END);
//   }

//   return result;
// };

// Example: https://github.com/electron-userland/electron-builder/blob/docs/encapsulated%20manual%20update%20via%20menu.js
// export function initializeAppUpdater(win: BrowserWindow): void {
//   autoUpdater.logger = log;
//   autoUpdater.autoDownload = true;
//   // autoUpdater.allowPrerelease = true;

//   autoUpdater.on("update-available", () => {
//     log.info(APP_UPDATE_AVAILABLE);
//     win.webContents.send(APP_UPDATE_AVAILABLE);
//   });

//   autoUpdater.on("update-not-available", () => {
//     log.info(APP_UPDATE_AVAILABLE);
//     win.webContents.send(APP_UPDATE_NOT_AVAILABLE);
//   });

//   autoUpdater.on("update-downloaded", () => {
//     log.info(APP_UPDATE_DOWNLOADED);
//     win.webContents.send(APP_UPDATE_DOWNLOADED);
//   });

//   autoUpdater.on("error", (e) => {
//     if (e.message.indexOf("dev-app-update.yml") !== -1) {
//       return;
//     }

//     log.error(APP_UPDATE_ERROR, e);
//     win.webContents.send(APP_UPDATE_ERROR, e);
//   });
// }

// export function initializeAppUpdateIpcHandlers(win: BrowserWindow): void {
//   ipcMain.handle(APP_UPDATE_START_DOWNLOAD, async () => {
//     log.info(APP_UPDATE_START_DOWNLOAD);
//     win.webContents.send(APP_UPDATE_START_DOWNLOAD);
//     return await autoUpdater.downloadUpdate();
//   });

//   // Used this solution for Mac support
//   // https://github.com/electron-userland/electron-builder/issues/1604#issuecomment-372091881
//   ipcMain.handle(APP_UPDATE_INSTALL, () => {
//     log.info(APP_UPDATE_INSTALL);
//     app.removeAllListeners("window-all-closed");
//     const browserWindows = BrowserWindow.getAllWindows();
//     browserWindows.forEach(function (browserWindow) {
//       browserWindow.removeAllListeners("close");
//     });
//     autoUpdater.quitAndInstall();
//   });

//   ipcMain.handle(APP_UPDATE_CHECK_FOR_UPDATE, async () => {
//     log.info(APP_UPDATE_CHECK_FOR_UPDATE);
//     try {
//       return await checkForUpdates(win);
//     } catch (e) {
//       console.error(e);
//     }
//   });
// }
