import axios from "axios";
import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent, Settings, shell } from "electron";
import * as log from "electron-log";
import * as fs from "fs-extra";
import * as globrex from "globrex";
import * as _ from "lodash";
import * as nodeDiskInfo from "node-disk-info";
import * as pLimit from "p-limit";
import * as path from "path";
import * as yauzl from "yauzl";

import { createAppMenu } from "./app-menu";
import {
  IPC_ADDONS_SAVE_ALL,
  IPC_CLOSE_WINDOW,
  IPC_COPY_FILE_CHANNEL,
  IPC_CREATE_APP_MENU_CHANNEL,
  IPC_CREATE_DIRECTORY_CHANNEL,
  IPC_CREATE_TRAY_MENU_CHANNEL,
  IPC_CURSE_GET_SCAN_RESULTS,
  IPC_DELETE_DIRECTORY_CHANNEL,
  IPC_DOWNLOAD_FILE_CHANNEL,
  IPC_GET_APP_VERSION,
  IPC_GET_ASSET_FILE_PATH,
  IPC_GET_LAUNCH_ARGS,
  IPC_GET_LOCALE,
  IPC_GET_LOGIN_ITEM_SETTINGS,
  IPC_SET_AS_DEFAULT_PROTOCOL_CLIENT,
  IPC_REMOVE_AS_DEFAULT_PROTOCOL_CLIENT,
  IPC_GET_ZOOM_FACTOR,
  IPC_LIST_DIRECTORIES_CHANNEL,
  IPC_LIST_DISKS_WIN32,
  IPC_LIST_ENTRIES,
  IPC_LIST_FILES_CHANNEL,
  IPC_MAXIMIZE_WINDOW,
  IPC_MINIMIZE_WINDOW,
  IPC_PATH_EXISTS_CHANNEL,
  IPC_QUIT_APP,
  IPC_READ_FILE_BUFFER_CHANNEL,
  IPC_READ_FILE_CHANNEL,
  IPC_READDIR,
  APP_PROTOCOL_NAME,
  IPC_RESTART_APP,
  IPC_SET_LOGIN_ITEM_SETTINGS,
  IPC_SET_ZOOM_FACTOR,
  IPC_SET_ZOOM_LIMITS,
  IPC_SHOW_DIRECTORY,
  IPC_STAT_FILES_CHANNEL,
  IPC_UNZIP_FILE_CHANNEL,
  IPC_WINDOW_LEAVE_FULLSCREEN,
  IPC_WOWUP_GET_SCAN_RESULTS,
  IPC_WRITE_FILE_CHANNEL,
  IPC_FOCUS_WINDOW,
  IPC_IS_DEFAULT_PROTOCOL_CLIENT,
} from "./src/common/constants";
import { CurseFolderScanner } from "./src/common/curse/curse-folder-scanner";
import { CurseFolderScanResult } from "./src/common/curse/curse-folder-scan-result";
import { CopyFileRequest } from "./src/common/models/copy-file-request";
import { DownloadRequest } from "./src/common/models/download-request";
import { DownloadStatus } from "./src/common/models/download-status";
import { DownloadStatusType } from "./src/common/models/download-status-type";
import { FsDirent, FsStats } from "./src/common/models/ipc-events";
import { UnzipRequest } from "./src/common/models/unzip-request";
import { RendererChannels } from "./src/common/wowup";
import { MenuConfig, SystemTrayConfig, WowUpScanResult } from "./src/common/wowup/models";
import { WowUpFolderScanner } from "./src/common/wowup/wowup-folder-scanner";
import { Addon } from "./src/common/entities/addon";
import { createTray, restoreWindow } from "./system-tray";
import { addonStore } from "./stores";
import { Transform } from "stream";

let USER_AGENT = "";

interface SymlinkDir {
  original: fs.Dirent;
  originalPath: string;
  realPath: string;
  isDir: boolean;
}

async function getSymlinkDirs(basePath: string, files: fs.Dirent[]): Promise<SymlinkDir[]> {
  // Find and resolve symlinks found and return the folder names as
  const symlinks = _.filter(files, (file) => file.isSymbolicLink());
  const symlinkDirs: SymlinkDir[] = _.map(symlinks, (sym) => {
    return {
      original: sym,
      originalPath: path.join(basePath, sym.name),
      realPath: "",
      isDir: false,
    };
  });

  for (const symlinkDir of symlinkDirs) {
    const realPath = await fs.realpath(symlinkDir.originalPath);
    const lstat = await fs.lstat(realPath);

    symlinkDir.realPath = realPath;
    symlinkDir.isDir = lstat.isDirectory();
  }

  return _.filter(symlinkDirs, (symDir) => symDir.isDir);
}

function handle(
  channel: RendererChannels,
  listener: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<void> | any
) {
  ipcMain.handle(channel, listener);
}

export function initializeIpcHandlers(window: BrowserWindow, userAgent: string): void {
  USER_AGENT = userAgent;

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
      log.info(`[CreateDirectory] '${directoryPath}'`);
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

  handle(IPC_ADDONS_SAVE_ALL, (evt, addons: Addon[]) => {
    _.forEach(addons, (addon) => addonStore.set(addon.id, addon));
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

  handle(IPC_IS_DEFAULT_PROTOCOL_CLIENT, (evt, protocol: string) => {
    return app.isDefaultProtocolClient(protocol);
  });

  handle(IPC_SET_AS_DEFAULT_PROTOCOL_CLIENT, (evt, protocol: string) => {
    return app.setAsDefaultProtocolClient(protocol);
  });

  handle(IPC_REMOVE_AS_DEFAULT_PROTOCOL_CLIENT, (evt, protocol: string) => {
    return app.removeAsDefaultProtocolClient(protocol);
  });

  handle(IPC_LIST_DIRECTORIES_CHANNEL, async (evt, filePath: string, scanSymlinks: boolean) => {
    const files = await fs.readdir(filePath, { withFileTypes: true });
    let symlinkNames: string[] = [];
    if (scanSymlinks === true) {
      log.info("Scanning symlinks");
      const symlinkDirs = await getSymlinkDirs(filePath, files);
      symlinkNames = _.map(symlinkDirs, (symLink) => symLink.original.name);
    }

    const directories = files.filter((file) => file.isDirectory()).map((file) => file.name);
    return [...directories, ...symlinkNames];
  });

  handle(IPC_STAT_FILES_CHANNEL, async (evt, filePaths: string[]) => {
    const results: { [path: string]: FsStats } = {};
    const limit = pLimit(3);
    const tasks = _.map(filePaths, (path) =>
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
    async (evt, filePaths: string[]): Promise<CurseFolderScanResult[]> => {
      // Scan addon folders in parallel for speed!?
      try {
        const limit = pLimit(2);
        const tasks = _.map(filePaths, (folder) => limit(() => new CurseFolderScanner().scanFolder(folder)));
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
      const tasks = _.map(filePaths, (folder) => limit(() => new WowUpFolderScanner(folder).scanFolder()));
      return await Promise.all(tasks);
    }
  );

  handle(IPC_UNZIP_FILE_CHANNEL, async (evt, arg: UnzipRequest) => {
    await new Promise((resolve, reject) => {
      yauzl.open(arg.zipFilePath, { lazyEntries: true }, (err, zipfile) => {
        handleZipFile(err, zipfile, arg.outputFolder).then(resolve).catch(reject);
      });
    });

    return arg.outputFolder;
  });

  handle(
    IPC_COPY_FILE_CHANNEL,
    async (evt, arg: CopyFileRequest): Promise<boolean> => {
      log.info(`[FileCopy] '${arg.sourceFilePath}' -> '${arg.destinationFilePath}'`);
      await fs.copy(arg.sourceFilePath, arg.destinationFilePath);
      return true;
    }
  );

  handle(IPC_DELETE_DIRECTORY_CHANNEL, async (evt, filePath: string) => {
    log.info(`[FileRemove] ${filePath}`);
    return new Promise((resolve, reject) => {
      fs.remove(filePath, (err) => {
        return err ? reject(err) : resolve(true);
      });
    });
  });

  handle(IPC_READ_FILE_CHANNEL, async (evt, filePath: string) => {
    return await fs.readFile(filePath, { encoding: "utf-8" });
  });

  handle(IPC_READ_FILE_BUFFER_CHANNEL, async (evt, filePath: string) => {
    return await fs.readFile(filePath);
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

  handle(IPC_FOCUS_WINDOW, () => {
    restoreWindow(window);
    window?.focus();
  });

  handle(IPC_RESTART_APP, () => {
    log.info(`[RestartApp]`);
    app.relaunch();
    app.quit();
  });

  handle(IPC_QUIT_APP, () => {
    log.info(`[QuitApp]`);
    app.quit();
  });

  handle(IPC_LIST_DISKS_WIN32, async () => {
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
      log.info(`[DownloadFile] '${arg.url}' -> '${savePath}'`);

      const { data, headers } = await axios({
        url: arg.url,
        method: "GET",
        responseType: "stream",
        headers: {
          "User-Agent": USER_AGENT,
        },
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
// Adapted from https://github.com/thejoshwolfe/yauzl/blob/96f0eb552c560632a754ae0e1701a7edacbda389/examples/unzip.js#L124
function handleZipFile(err: Error, zipfile: yauzl.ZipFile, targetDir: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (err) {
      return reject(err);
    }

    zipfile.on("close", function () {
      resolve(true);
    });

    zipfile.on("error", (error: Error) => {
      reject(err);
    });

    zipfile.readEntry();
    zipfile.on("entry", function (entry) {
      if (/\/$/.test(entry.fileName)) {
        // directory file names end with '/'
        const dirPath = path.join(targetDir, entry.fileName);
        fs.mkdirp(dirPath, function () {
          if (err) throw err;
          zipfile.readEntry();
        });
      } else {
        // ensure parent directory exists
        const filePath = path.join(targetDir, entry.fileName);
        const parentPath = path.join(targetDir, path.dirname(entry.fileName));
        fs.mkdirp(parentPath, function () {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              throw err;
            }

            const filter = new Transform();
            filter._transform = function (chunk, encoding, cb) {
              cb(null, chunk);
            };
            filter._flush = function (cb) {
              process.stdout.write("\b \b\b \b\b \b\n");
              cb();
              zipfile.readEntry();
            };

            // pump file contents
            const writeStream = fs.createWriteStream(filePath);
            readStream.pipe(filter).pipe(writeStream);
          });
        });
      }
    });
  });
}
