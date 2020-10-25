import { BrowserWindow, ipcMain } from "electron";
import * as log from "electron-log";
import { autoUpdater } from "electron-updater";
import {
  APP_UPDATE_AVAILABLE,
  APP_UPDATE_CHECK_FOR_UPDATE,
  APP_UPDATE_DOWNLOADED,
  APP_UPDATE_ERROR,
  APP_UPDATE_INSTALL,
  APP_UPDATE_NOT_AVAILABLE,
  APP_UPDATE_START_DOWNLOAD,
} from "./src/common/constants";

// Example: https://github.com/electron-userland/electron-builder/blob/docs/encapsulated%20manual%20update%20via%20menu.js
export class AppUpdater {
  constructor(window: BrowserWindow) {
    this.initializeIpcHandlers();
    this.initializeUpdater(window);
  }

  private initializeUpdater(win: BrowserWindow) {
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;
    autoUpdater.allowPrerelease = true;
    autoUpdater.channel = "alpha";

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

  private initializeIpcHandlers() {
    ipcMain.handle(APP_UPDATE_START_DOWNLOAD, async () => {
      log.info(APP_UPDATE_START_DOWNLOAD);
      autoUpdater.downloadUpdate();
    });

    ipcMain.handle(APP_UPDATE_INSTALL, async () => {
      log.info(APP_UPDATE_INSTALL);
      autoUpdater.quitAndInstall();
    });

    ipcMain.handle(APP_UPDATE_CHECK_FOR_UPDATE, async () => {
      log.info(APP_UPDATE_CHECK_FOR_UPDATE);
      return await autoUpdater.checkForUpdates();
    });
  }
}
