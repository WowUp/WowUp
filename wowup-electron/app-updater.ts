import { app, BrowserWindow, ipcMain } from "electron";
import * as log from "electron-log";
import { autoUpdater, UpdateCheckResult } from "electron-updater";
import {
  APP_UPDATE_AVAILABLE,
  APP_UPDATE_CHECK_END,
  APP_UPDATE_CHECK_FOR_UPDATE,
  APP_UPDATE_CHECK_START,
  APP_UPDATE_DOWNLOADED,
  APP_UPDATE_ERROR,
  APP_UPDATE_INSTALL,
  APP_UPDATE_NOT_AVAILABLE,
  APP_UPDATE_START_DOWNLOAD,
} from "./src/common/constants";

export const checkForUpdates = async (win: BrowserWindow): Promise<UpdateCheckResult> => {
  let result = null;

  try {
    win.webContents.send(APP_UPDATE_CHECK_START);
    result = await autoUpdater.checkForUpdates();
  } finally {
    win.webContents.send(APP_UPDATE_CHECK_END);
  }

  return result;
};

// Example: https://github.com/electron-userland/electron-builder/blob/docs/encapsulated%20manual%20update%20via%20menu.js
export function initializeAppUpdater(win: BrowserWindow): void {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;
  // autoUpdater.allowPrerelease = true;

  autoUpdater.on("update-available", () => {
    log.info(APP_UPDATE_AVAILABLE);
    win.webContents.send(APP_UPDATE_AVAILABLE);
  });

  autoUpdater.on("update-not-available", () => {
    log.info(APP_UPDATE_AVAILABLE);
    win.webContents.send(APP_UPDATE_NOT_AVAILABLE);
  });

  autoUpdater.on("update-downloaded", () => {
    log.info(APP_UPDATE_DOWNLOADED);
    win.webContents.send(APP_UPDATE_DOWNLOADED);
  });

  autoUpdater.on("error", (e) => {
    if (e.message.indexOf("dev-app-update.yml") !== -1) {
      return;
    }

    log.error(APP_UPDATE_ERROR, e);
    win.webContents.send(APP_UPDATE_ERROR, e);
  });
}

export function initializeAppUpdateIpcHandlers(win: BrowserWindow): void {
  ipcMain.handle(APP_UPDATE_START_DOWNLOAD, async () => {
    log.info(APP_UPDATE_START_DOWNLOAD);
    win.webContents.send(APP_UPDATE_START_DOWNLOAD);
    return await autoUpdater.downloadUpdate();
  });

  // Used this solution for Mac support
  // https://github.com/electron-userland/electron-builder/issues/1604#issuecomment-372091881
  ipcMain.handle(APP_UPDATE_INSTALL, () => {
    log.info(APP_UPDATE_INSTALL);
    app.removeAllListeners("window-all-closed");
    const browserWindows = BrowserWindow.getAllWindows();
    browserWindows.forEach(function (browserWindow) {
      browserWindow.removeAllListeners("close");
    });
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle(APP_UPDATE_CHECK_FOR_UPDATE, async () => {
    log.info(APP_UPDATE_CHECK_FOR_UPDATE);
    return await checkForUpdates(win);
  });
}
