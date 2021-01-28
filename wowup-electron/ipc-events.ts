import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent, Settings, shell } from "electron";
import * as fs from "fs-extra";
import * as path from "path";
import * as _ from "lodash";
import * as admZip from "adm-zip";
import * as pLimit from "p-limit";
import * as nodeDiskInfo from "node-disk-info";
import { map } from "lodash";
import { readdir } from "fs";
import axios from "axios";
import * as log from "electron-log";
import * as globrex from "globrex";

import {
  IPC_LIST_DIRECTORIES_CHANNEL,
  IPC_SHOW_DIRECTORY,
  IPC_PATH_EXISTS_CHANNEL,
  IPC_CURSE_GET_SCAN_RESULTS,
  IPC_WOWUP_GET_SCAN_RESULTS,
  IPC_UNZIP_FILE_CHANNEL,
  IPC_COPY_FILE_CHANNEL,
  IPC_DELETE_DIRECTORY_CHANNEL,
  IPC_READ_FILE_CHANNEL,
  IPC_WRITE_FILE_CHANNEL,
  IPC_GET_ASSET_FILE_PATH,
  IPC_DOWNLOAD_FILE_CHANNEL,
  IPC_CREATE_DIRECTORY_CHANNEL,
  IPC_STAT_FILES_CHANNEL,
  IPC_CREATE_TRAY_MENU_CHANNEL,
  IPC_LIST_DISKS_WIN32,
  IPC_CREATE_APP_MENU_CHANNEL,
  IPC_MINIMIZE_WINDOW,
  IPC_MAXIMIZE_WINDOW,
  IPC_CLOSE_WINDOW,
  IPC_RESTART_APP,
  IPC_QUIT_APP,
  IPC_WINDOW_LEAVE_FULLSCREEN,
  IPC_GET_ZOOM_FACTOR,
  IPC_SET_ZOOM_LIMITS,
  IPC_SET_ZOOM_FACTOR,
  IPC_GET_APP_VERSION,
  IPC_GET_LOCALE,
  IPC_GET_LAUNCH_ARGS,
  IPC_GET_LOGIN_ITEM_SETTINGS,
  IPC_SET_LOGIN_ITEM_SETTINGS,
  IPC_LIST_ENTRIES,
  IPC_LIST_FILES_CHANNEL,
  IPC_READDIR,
} from "./src/common/constants";
import { CurseScanResult } from "./src/common/curse/curse-scan-result";
import { CurseFolderScanner } from "./src/common/curse/curse-folder-scanner";

import { WowUpFolderScanner } from "./src/common/wowup/wowup-folder-scanner";
import { WowUpScanResult } from "./src/common/wowup/wowup-scan-result";
import { UnzipRequest } from "./src/common/models/unzip-request";
import { FsDirent, FsStats } from "./src/common/models/ipc-events";
import { CopyFileRequest } from "./src/common/models/copy-file-request";
import { DownloadStatus } from "./src/common/models/download-status";
import { DownloadStatusType } from "./src/common/models/download-status-type";
import { DownloadRequest } from "./src/common/models/download-request";
import { SystemTrayConfig } from "./src/common/wowup/system-tray-config";
import { MenuConfig } from "./src/common/wowup/menu-config";
import { createTray } from "./system-tray";
import { createAppMenu } from "./app-menu";
import { RendererChannels } from "./src/common/wowup";

function handle(
  channel: RendererChannels,
  listener: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<void> | any
) {
  ipcMain.handle(channel, listener);
}

export function initializeIpcHandlers(window: BrowserWindow): void {
  handle(
    IPC_SHOW_DIRECTORY,
    async (evt, filePath: string): Promise<string> => {
      return await shell.openPath(filePath);
    }
  );

  handle(IPC_GET_ASSET_FILE_PATH, (evt, fileName: string) => {
    return path.join(__dirname, "assets", fileName);
  });

  handle(
    IPC_CREATE_DIRECTORY_CHANNEL,
    async (evt, directoryPath: string): Promise<boolean> => {
      await fs.ensureDir(directoryPath);
      return true;
    }
  );

  handle(IPC_GET_ZOOM_FACTOR, () => {
    return window?.webContents?.getZoomFactor();
  });

  handle(IPC_SET_ZOOM_LIMITS, (evt, minimumLevel: number, maximumLevel: number) => {
    return window.webContents?.setVisualZoomLevelLimits(minimumLevel, maximumLevel);
  });

  handle(IPC_SET_ZOOM_FACTOR, (evt, zoomFactor: number) => {
    if (window?.webContents) {
      window.webContents.zoomFactor = zoomFactor;
    }
  });

  handle(IPC_GET_APP_VERSION, () => {
    return app.getVersion();
  });

  handle(IPC_GET_LOCALE, () => {
    return `${app.getLocale()}`;
  });

  handle(IPC_GET_LAUNCH_ARGS, () => {
    return process.argv;
  });

  handle(IPC_GET_LOGIN_ITEM_SETTINGS, () => {
    return app.getLoginItemSettings();
  });

  handle(IPC_SET_LOGIN_ITEM_SETTINGS, (evt, settings: Settings) => {
    return app.setLoginItemSettings(settings);
  });

  handle(
    IPC_READDIR,
    async (evt, dirPath: string): Promise<string[]> => {
      return await fs.readdir(dirPath);
    }
  );

  handle(IPC_LIST_DIRECTORIES_CHANNEL, (evt, filePath: string) => {
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

  handle(IPC_STAT_FILES_CHANNEL, async (evt, filePaths: string[]) => {
    const results: { [path: string]: FsStats } = {};
    const limit = pLimit(3);
    const tasks = map(filePaths, (path) =>
      limit(async () => {
        const stats = await fs.stat(path);
        const fsStats: FsStats = {
          atime: stats.atime,
          atimeMs: stats.atimeMs,
          birthtime: stats.birthtime,
          birthtimeMs: stats.birthtimeMs,
          blksize: stats.blksize,
          blocks: stats.blocks,
          ctime: stats.ctime,
          ctimeMs: stats.ctimeMs,
          dev: stats.dev,
          gid: stats.gid,
          ino: stats.ino,
          isBlockDevice: stats.isBlockDevice(),
          isCharacterDevice: stats.isCharacterDevice(),
          isDirectory: stats.isDirectory(),
          isFIFO: stats.isFIFO(),
          isFile: stats.isFile(),
          isSocket: stats.isSocket(),
          isSymbolicLink: stats.isSymbolicLink(),
          mode: stats.mode,
          mtime: stats.mtime,
          mtimeMs: stats.mtimeMs,
          nlink: stats.nlink,
          rdev: stats.rdev,
          size: stats.size,
          uid: stats.uid,
        };
        return { path, fsStats };
      })
    );

    const taskResults = await Promise.all(tasks);
    taskResults.forEach((r) => (results[r.path] = r.fsStats));

    return results;
  });

  handle(IPC_LIST_ENTRIES, async (evt, sourcePath: string, filter: string) => {
    const globFilter = globrex(filter);
    const results = await fs.readdir(sourcePath, { withFileTypes: true });
    const matches = _.filter(results, (entry) => globFilter.regex.test(entry.name));
    return _.map(matches, (match) => {
      const dirEnt: FsDirent = {
        isBlockDevice: match.isBlockDevice(),
        isCharacterDevice: match.isCharacterDevice(),
        isDirectory: match.isDirectory(),
        isFIFO: match.isFIFO(),
        isFile: match.isFile(),
        isSocket: match.isSocket(),
        isSymbolicLink: match.isSymbolicLink(),
        name: match.name,
      };
      return dirEnt;
    });
  });

  handle(IPC_LIST_FILES_CHANNEL, async (evt, sourcePath: string, filter: string) => {
    const globFilter = globrex(filter);
    const results = await fs.readdir(sourcePath, { withFileTypes: true });
    const matches = _.filter(results, (entry) => globFilter.regex.test(entry.name));
    return _.map(matches, (match) => match.name);
  });

  handle(IPC_PATH_EXISTS_CHANNEL, async (evt, filePath: string) => {
    if (!filePath) {
      return false;
    }

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

  handle(
    IPC_CURSE_GET_SCAN_RESULTS,
    async (evt, filePaths: string[]): Promise<CurseScanResult[]> => {
      // Scan addon folders in parallel for speed!?
      try {
        const limit = pLimit(2);
        const tasks = map(filePaths, (folder) => limit(() => new CurseFolderScanner().scanFolder(folder)));
        return await Promise.all(tasks);
      } catch (e) {
        log.error("Failed during curse scan", e);
        throw e;
      }
    }
  );

  handle(
    IPC_WOWUP_GET_SCAN_RESULTS,
    async (evt, filePaths: string[]): Promise<WowUpScanResult[]> => {
      const limit = pLimit(2);
      const tasks = map(filePaths, (folder) => limit(() => new WowUpFolderScanner(folder).scanFolder()));
      return await Promise.all(tasks);
    }
  );

  handle(IPC_UNZIP_FILE_CHANNEL, async (evt, arg: UnzipRequest) => {
    const zip = new admZip(arg.zipFilePath);
    await new Promise((resolve, reject) => {
      zip.extractAllToAsync(arg.outputFolder, true, (err) => {
        return err ? reject(err) : resolve(true);
      });
    });

    return arg.outputFolder;
  });

  handle(
    IPC_COPY_FILE_CHANNEL,
    async (evt, arg: CopyFileRequest): Promise<boolean> => {
      await fs.copy(arg.sourceFilePath, arg.destinationFilePath);
      return true;
    }
  );

  handle(IPC_DELETE_DIRECTORY_CHANNEL, async (evt, filePath: string) => {
    await fs.remove(filePath);

    return true;
  });

  handle(IPC_READ_FILE_CHANNEL, async (evt, filePath: string) => {
    return await fs.readFile(filePath, { encoding: "utf-8" });
  });

  handle(IPC_WRITE_FILE_CHANNEL, async (evt, filePath: string, contents: string) => {
    return await fs.writeFile(filePath, contents, { encoding: "utf-8" });
  });

  handle(IPC_CREATE_TRAY_MENU_CHANNEL, (evt, config: SystemTrayConfig) => {
    return createTray(window, config);
  });

  handle(IPC_CREATE_APP_MENU_CHANNEL, (evt, config: MenuConfig) => {
    return createAppMenu(window, config);
  });

  handle(IPC_MINIMIZE_WINDOW, () => {
    if (window?.minimizable) {
      window.minimize();
    }
  });

  handle(IPC_MAXIMIZE_WINDOW, () => {
    if (window?.maximizable) {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    }
  });

  handle(IPC_CLOSE_WINDOW, () => {
    window?.close();
  });

  handle(IPC_RESTART_APP, () => {
    app.relaunch();
    app.quit();
  });

  handle(IPC_QUIT_APP, () => {
    app.quit();
  });

  handle(IPC_LIST_DISKS_WIN32, async (evt, config: SystemTrayConfig) => {
    const diskInfos = await nodeDiskInfo.getDiskInfo();
    // Cant pass complex objects over the wire, make them simple
    return diskInfos.map((di) => {
      return {
        mounted: di.mounted,
        filesystem: di.filesystem,
      };
    });
  });

  handle(IPC_WINDOW_LEAVE_FULLSCREEN, () => {
    window?.setFullScreen(false);
  });

  ipcMain.on(IPC_DOWNLOAD_FILE_CHANNEL, (evt, arg: DownloadRequest) => {
    handleDownloadFile(arg).catch((e) => console.error(e));
  });

  async function handleDownloadFile(arg: DownloadRequest) {
    try {
      const savePath = path.join(arg.outputFolder, arg.fileName);

      const { data, headers } = await axios({
        url: arg.url,
        method: "GET",
        responseType: "stream",
      });

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
  }
}
