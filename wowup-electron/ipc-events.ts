import { BrowserWindow, ipcMain, shell } from "electron";
import * as fs from "fs-extra";
import * as async from "async";
import * as path from "path";
import * as admZip from "adm-zip";
import { readdir } from "fs";
import axios from "axios";
import * as log from "electron-log";

import {
  LIST_DIRECTORIES_CHANNEL,
  SHOW_DIRECTORY,
  PATH_EXISTS_CHANNEL,
  CURSE_GET_SCAN_RESULTS,
  WOWUP_GET_SCAN_RESULTS,
  UNZIP_FILE_CHANNEL,
  COPY_FILE_CHANNEL,
  DELETE_DIRECTORY_CHANNEL,
  READ_FILE_CHANNEL,
  WRITE_FILE_CHANNEL,
  GET_ASSET_FILE_PATH,
  DOWNLOAD_FILE_CHANNEL,
  CREATE_DIRECTORY_CHANNEL,
  CREATE_TRAY_MENU_CHANNEL,
} from "./src/common/constants";
import { CurseScanResult } from "./src/common/curse/curse-scan-result";
import { CurseFolderScanner } from "./src/common/curse/curse-folder-scanner";

import { WowUpFolderScanner } from "./src/common/wowup/wowup-folder-scanner";
import { WowUpScanResult } from "./src/common/wowup/wowup-scan-result";
import { UnzipRequest } from "./src/common/models/unzip-request";
import { CopyFileRequest } from "./src/common/models/copy-file-request";
import { DownloadStatus } from "./src/common/models/download-status";
import { DownloadStatusType } from "./src/common/models/download-status-type";
import { DownloadRequest } from "./src/common/models/download-request";
import { SystemTrayConfig } from "./src/common/wowup/system-tray-config";
import { createTray } from "./system-tray";

export function initializeIpcHanders(window: BrowserWindow) {
  ipcMain.handle(
    SHOW_DIRECTORY,
    async (evt, filePath: string): Promise<string> => {
      log.info(SHOW_DIRECTORY, filePath);
      return await shell.openPath(filePath);
    }
  );

  ipcMain.handle(GET_ASSET_FILE_PATH, async (evt, fileName: string) => {
    return path.join(__dirname, "assets", fileName);
  });

  ipcMain.handle(
    CREATE_DIRECTORY_CHANNEL,
    async (evt, directoryPath: string): Promise<boolean> => {
      await fs.ensureDir(directoryPath);
      return true;
    }
  );

  ipcMain.handle(LIST_DIRECTORIES_CHANNEL, (evt, filePath: string) => {
    log.info(LIST_DIRECTORIES_CHANNEL, filePath);

    return new Promise((resolve, reject) => {
      readdir(filePath, { withFileTypes: true }, (err, files) => {
        if (err) {
          return reject(err);
        }

        const directories = files.filter((file) => file.isDirectory()).map((file) => file.name);

        resolve(directories);
      });
    });
  });

  ipcMain.handle(PATH_EXISTS_CHANNEL, async (evt, filePath: string) => {
    log.info(PATH_EXISTS_CHANNEL, filePath);

    try {
      await fs.access(filePath);
    } catch (e) {
      if (e.code !== "ENOENT") {
        log.error(e);
      }
      return false;
    }

    return true;
  });

  ipcMain.handle(
    CURSE_GET_SCAN_RESULTS,
    async (evt, filePaths: string[]): Promise<CurseScanResult[]> => {
      log.info(CURSE_GET_SCAN_RESULTS, filePaths);

      // Scan addon folders in parallel for speed!?
      try {
        const results = await async.mapLimit<string, CurseScanResult>(filePaths, 2, async (folder, callback) => {
          const scanResult = await new CurseFolderScanner().scanFolder(folder);

          callback(undefined, scanResult);
        });

        log.info(CURSE_GET_SCAN_RESULTS, "complete");

        return results;
      } catch (e) {
        log.error("Failed during curse scan", e);
        throw e;
      }
    }
  );

  ipcMain.handle(
    WOWUP_GET_SCAN_RESULTS,
    async (evt, filePaths: string[]): Promise<WowUpScanResult[]> => {
      log.info(WOWUP_GET_SCAN_RESULTS, filePaths);

      return await async.mapLimit<string, WowUpScanResult>(filePaths, 2, async (folder, callback) => {
        const scanResult = await new WowUpFolderScanner(folder).scanFolder();

        callback(undefined, scanResult);
      });
    }
  );

  ipcMain.handle(UNZIP_FILE_CHANNEL, async (evt, arg: UnzipRequest) => {
    log.info(UNZIP_FILE_CHANNEL, arg);

    const zip = new admZip(arg.zipFilePath);
    await new Promise((resolve, reject) => {
      zip.extractAllToAsync(arg.outputFolder, true, (err) => {
        return err ? reject(err) : resolve(true);
      });
    });

    return arg.outputFolder;
  });

  ipcMain.handle(
    COPY_FILE_CHANNEL,
    async (evt, arg: CopyFileRequest): Promise<boolean> => {
      log.info("Copy File", arg);
      await fs.copy(arg.sourceFilePath, arg.destinationFilePath);
      return true;
    }
  );

  ipcMain.handle(DELETE_DIRECTORY_CHANNEL, async (evt, filePath: string) => {
    log.info("Delete File/Dir", filePath);

    await fs.remove(filePath);

    return true;
  });

  ipcMain.handle(READ_FILE_CHANNEL, async (evt, filePath: string) => {
    return await fs.readFile(filePath, { encoding: "utf-8" });
  });

  ipcMain.handle(WRITE_FILE_CHANNEL, async (evt, filePath: string, contents: string) => {
    return await fs.writeFile(filePath, contents, { encoding: "utf-8" });
  });

  ipcMain.handle(CREATE_TRAY_MENU_CHANNEL, async (evt, config: SystemTrayConfig) => {
    return createTray(window, config);
  });

  ipcMain.on(DOWNLOAD_FILE_CHANNEL, async (evt, arg: DownloadRequest) => {
    try {
      const savePath = path.join(arg.outputFolder, arg.fileName);

      const { data, headers } = await axios({
        url: arg.url,
        method: "GET",
        responseType: "stream",
      });

      log.info("Starting download");

      // const totalLength = headers["content-length"];
      // Progress is not shown anywhere
      // data.on("data", (chunk) => {
      //   log.info("DLPROG", arg.responseKey);
      // });

      const writer = fs.createWriteStream(savePath);
      data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      const status: DownloadStatus = {
        type: DownloadStatusType.Complete,
        savePath,
      };
      window.webContents.send(arg.responseKey, status);
    } catch (err) {
      log.error(err);
      const status: DownloadStatus = {
        type: DownloadStatusType.Error,
        error: err,
      };
      window.webContents.send(arg.responseKey, status);
    }
  });
}
