import { BrowserWindow, ipcMain } from "electron";
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

export const checkForUpdates = async function checkForUpdates(
  win?: BrowserWindow
) {
  win = win || BrowserWindow.getFocusedWindow();
  let result = {} as UpdateCheckResult;
  
  try {
    win.webContents.send(APP_UPDATE_CHECK_START);
    result = await autoUpdater.checkForUpdates();
  } catch (err) {}

  win.webContents.send(APP_UPDATE_CHECK_END);
  return result;
};


// Example: https://github.com/electron-userland/electron-builder/blob/docs/encapsulated%20manual%20update%20via%20menu.js
export function initializeAppUpdater(win: BrowserWindow) {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;
  autoUpdater.allowPrerelease = true;
  // autoUpdater.channel = "alpha";

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
    log.error(APP_UPDATE_ERROR, e);
    win.webContents.send(APP_UPDATE_ERROR, e);
  });
}

export function initializeAppUpdateIpcHandlers(win: BrowserWindow) {
  ipcMain.handle(APP_UPDATE_START_DOWNLOAD, async () => {
    log.info(APP_UPDATE_START_DOWNLOAD);
    win.webContents.send(APP_UPDATE_START_DOWNLOAD);
    return await autoUpdater.downloadUpdate();
  });

  ipcMain.handle(APP_UPDATE_INSTALL, async () => {
    log.info(APP_UPDATE_INSTALL);
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle(APP_UPDATE_CHECK_FOR_UPDATE, async () => {
    log.info(APP_UPDATE_CHECK_FOR_UPDATE);
    return await checkForUpdates(win);
  });
}
