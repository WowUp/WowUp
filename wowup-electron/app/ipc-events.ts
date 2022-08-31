import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  IpcMainInvokeEvent,
  net,
  OpenDialogOptions,
  Settings,
  shell,
  systemPreferences,
} from "electron";
import * as log from "electron-log";
import * as globrex from "globrex";
import * as _ from "lodash";
import { nanoid } from "nanoid";
import * as nodeDiskInfo from "node-disk-info";
import * as path from "path";
import { Transform } from "stream";
import * as yauzl from "yauzl";
import * as fs from "fs";
import * as os from "os";

import {
  IPC_ADDONS_SAVE_ALL,
  IPC_CLOSE_WINDOW,
  IPC_COPY_FILE_CHANNEL,
  IPC_CREATE_APP_MENU_CHANNEL,
  IPC_CREATE_DIRECTORY_CHANNEL,
  IPC_CREATE_TRAY_MENU_CHANNEL,
  IPC_DELETE_DIRECTORY_CHANNEL,
  IPC_DOWNLOAD_FILE_CHANNEL,
  IPC_FOCUS_WINDOW,
  IPC_GET_APP_VERSION,
  IPC_GET_HOME_DIR,
  IPC_GET_ASSET_FILE_PATH,
  IPC_GET_DIRECTORY_TREE,
  IPC_GET_LATEST_DIR_UPDATE_TIME,
  IPC_GET_LAUNCH_ARGS,
  IPC_GET_LOCALE,
  IPC_GET_LOGIN_ITEM_SETTINGS,
  IPC_GET_PENDING_OPEN_URLS,
  IPC_GET_ZOOM_FACTOR,
  IPC_IS_DEFAULT_PROTOCOL_CLIENT,
  IPC_LIST_DIR_RECURSIVE,
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
  IPC_REMOVE_AS_DEFAULT_PROTOCOL_CLIENT,
  IPC_RESTART_APP,
  IPC_SET_AS_DEFAULT_PROTOCOL_CLIENT,
  IPC_SET_LOGIN_ITEM_SETTINGS,
  IPC_SET_ZOOM_FACTOR,
  IPC_SET_ZOOM_LIMITS,
  IPC_SHOW_DIRECTORY,
  IPC_SHOW_OPEN_DIALOG,
  IPC_STAT_FILES_CHANNEL,
  IPC_SYSTEM_PREFERENCES_GET_USER_DEFAULT,
  IPC_UNZIP_FILE_CHANNEL,
  IPC_UPDATE_APP_BADGE,
  IPC_WINDOW_LEAVE_FULLSCREEN,
  IPC_WOWUP_GET_SCAN_RESULTS,
  IPC_WRITE_FILE_CHANNEL,
  DEFAULT_FILE_MODE,
  IPC_PUSH_INIT,
  IPC_PUSH_REGISTER,
  IPC_PUSH_UNREGISTER,
  IPC_PUSH_SUBSCRIBE,
  IPC_WINDOW_IS_FULLSCREEN,
  IPC_WINDOW_IS_MAXIMIZED,
} from "../src/common/constants";
import { Addon } from "../src/common/entities/addon";
import { CopyFileRequest } from "../src/common/models/copy-file-request";
import { DownloadRequest } from "../src/common/models/download-request";
import { DownloadStatus } from "../src/common/models/download-status";
import { DownloadStatusType } from "../src/common/models/download-status-type";
import { FsDirent, FsStats, TreeNode } from "../src/common/models/ipc-events";
import { UnzipRequest } from "../src/common/models/unzip-request";
import { RendererChannels } from "../src/common/wowup";
import { MenuConfig, SystemTrayConfig, WowUpScanResult } from "../src/common/wowup/models";
import { createAppMenu } from "./app-menu";
import * as fsp from "fs/promises";

import {
  chmodDir,
  copyDir,
  exists,
  getDirTree,
  getLastModifiedFileDate,
  listZipFiles,
  readDirRecursive,
  readFileInZip,
  remove,
  zipFile,
} from "./file.utils";
import { addonStore } from "./stores";
import { createTray } from "./system-tray";
import { WowUpFolderScanner } from "./wowup-folder-scanner";
import * as push from "./push";
import { GetDirectoryTreeRequest } from "../src/common/models/ipc-request";
import { ProductDb } from "../src/common/wowup/product-db";
import { restoreWindow } from "./window-state";
import { firstValueFrom, from, mergeMap, toArray } from "rxjs";

let PENDING_OPEN_URLS: string[] = [];

interface SymlinkDir {
  original: fs.Dirent;
  originalPath: string;
  realPath: string;
  isDir: boolean;
}

const _dlMap = new Map<string, (evt: Electron.Event, item: Electron.DownloadItem, ec: Electron.WebContents) => void>();

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
    const realPath = await fsp.realpath(symlinkDir.originalPath);
    const lstat = await fsp.lstat(realPath);

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

// When doing a cold start on mac, open-url will happen before the app is loaded
export function setPendingOpenUrl(...openUrls: string[]): void {
  PENDING_OPEN_URLS = openUrls;
}

export function initializeIpcHandlers(window: BrowserWindow): void {
  log.info("process.versions", process.versions);

  /* eslint-disable @typescript-eslint/no-unsafe-argument */
  ipcMain.on("webview-log", (evt, level, ...data) => {
    switch (level) {
      case "error":
        log.error(...data);
        break;
      case "warn":
        log.warn(...data);
        break;
      default:
        log.info(...data);
        break;
    }
  });
  /* eslint-enable @typescript-eslint/no-unsafe-argument */

  ipcMain.on("webview-error", (evt, err, msg) => {
    log.error("webview-error", err, msg);
  });

  // Just forward the token event out to the window
  // this is not a handler, just a passive listener
  ipcMain.on("wago-token-received", (evt, token) => {
    window?.webContents?.send("wago-token-received", token);
  });

  // Remove the pending URLs once read so they are only able to be gotten once
  handle(IPC_GET_PENDING_OPEN_URLS, (): string[] => {
    const urls = PENDING_OPEN_URLS;
    PENDING_OPEN_URLS = [];
    return urls;
  });

  handle(
    IPC_SYSTEM_PREFERENCES_GET_USER_DEFAULT,
    (
      _evt,
      key: string,
      type: "string" | "boolean" | "integer" | "float" | "double" | "url" | "array" | "dictionary"
    ) => {
      return systemPreferences.getUserDefault(key, type);
    }
  );

  handle("clipboard-read-text", () => {
    return clipboard.readText();
  });

  handle(IPC_SHOW_DIRECTORY, async (evt, filePath: string): Promise<string> => {
    return await shell.openPath(filePath);
  });

  handle(IPC_GET_ASSET_FILE_PATH, (evt, fileName: string) => {
    return path.join(__dirname, "..", "assets", fileName);
  });

  handle(IPC_CREATE_DIRECTORY_CHANNEL, async (evt, directoryPath: string): Promise<boolean> => {
    log.info(`[CreateDirectory] '${directoryPath}'`);
    await fsp.mkdir(directoryPath, { recursive: true });
    return true;
  });

  handle(IPC_GET_ZOOM_FACTOR, () => {
    return window?.webContents?.getZoomFactor();
  });

  handle(IPC_UPDATE_APP_BADGE, (evt, count: number) => {
    return app.setBadgeCount(count);
  });

  handle(IPC_SET_ZOOM_LIMITS, (evt, minimumLevel: number, maximumLevel: number) => {
    return window.webContents?.setVisualZoomLevelLimits(minimumLevel, maximumLevel);
  });

  handle("show-item-in-folder", (evt, path: string) => {
    shell.showItemInFolder(path);
  });

  handle(IPC_SET_ZOOM_FACTOR, (evt, zoomFactor: number) => {
    if (window?.webContents) {
      window.webContents.zoomFactor = zoomFactor;
    }
  });

  handle(IPC_ADDONS_SAVE_ALL, (evt, addons: Addon[]) => {
    if (!Array.isArray(addons)) {
      return;
    }

    for (const addon of addons) {
      addonStore.set(addon.id, addon);
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

  handle(IPC_READDIR, async (evt, dirPath: string): Promise<string[]> => {
    return await fsp.readdir(dirPath);
  });

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
    const files = await fsp.readdir(filePath, { withFileTypes: true });
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

    const taskResults = await firstValueFrom(
      from(filePaths).pipe(
        mergeMap((filePath) => from(statFile(filePath)), 3),
        toArray()
      )
    );

    taskResults.forEach((r) => (results[r.path] = r.fsStats));

    return results;
  });

  handle(IPC_LIST_ENTRIES, async (evt, sourcePath: string, filter: string) => {
    const globFilter = globrex(filter);
    const results = await fsp.readdir(sourcePath, { withFileTypes: true });
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
    const pathExists = await exists(sourcePath);
    if (!pathExists) {
      return [];
    }

    const globFilter = globrex(filter);
    const results = await fsp.readdir(sourcePath, { withFileTypes: true });
    const matches = _.filter(results, (entry) => globFilter.regex.test(entry.name));
    return _.map(matches, (match) => match.name);
  });

  handle(IPC_PATH_EXISTS_CHANNEL, async (evt, filePath: string) => {
    if (!filePath) {
      return false;
    }

    try {
      await fsp.access(filePath);
    } catch (e) {
      if (e.code !== "ENOENT") {
        log.error(e);
      }
      return false;
    }

    return true;
  });

  handle(IPC_WOWUP_GET_SCAN_RESULTS, async (evt, filePaths: string[]): Promise<WowUpScanResult[]> => {
    const taskResults = await firstValueFrom(
      from(filePaths).pipe(
        mergeMap((folder) => from(new WowUpFolderScanner(folder).scanFolder()), 3),
        toArray()
      )
    );

    return taskResults;
  });

  handle(IPC_UNZIP_FILE_CHANNEL, async (evt, arg: UnzipRequest) => {
    await new Promise((resolve, reject) => {
      yauzl.open(arg.zipFilePath, { lazyEntries: true }, (err, zipfile) => {
        handleZipFile(err, zipfile, arg.outputFolder).then(resolve).catch(reject);
      });
    });

    await chmodDir(arg.outputFolder, DEFAULT_FILE_MODE);

    return arg.outputFolder;
  });

  handle("zip-file", async (evt, srcPath: string, destPath: string) => {
    log.info(`[ZipFile]: '${srcPath} -> ${destPath}`);
    return await zipFile(srcPath, destPath);
  });

  handle("zip-read-file", async (evt, zipPath: string, filePath: string) => {
    log.info(`[ZipReadFile]: '${zipPath} : ${filePath}`);
    return await readFileInZip(zipPath, filePath);
  });

  handle("zip-list-files", (evt, zipPath: string, filter: string) => {
    log.info(`[ZipListEntries]: '${zipPath}`);
    return listZipFiles(zipPath, filter);
  });

  handle("rename-file", async (evt, srcPath: string, destPath: string) => {
    log.info(`[RenameFile]: '${srcPath} -> ${destPath}`);
    return await fsp.rename(srcPath, destPath);
  });

  handle("base64-encode", (evt, content: string) => {
    const buff = Buffer.from(content);
    return buff.toString("base64");
  });

  handle("base64-decode", (evt, content: string) => {
    const buff = Buffer.from(content, "base64");
    return buff.toString("utf-8");
  });

  handle(IPC_COPY_FILE_CHANNEL, async (evt, arg: CopyFileRequest): Promise<boolean> => {
    log.info(`[FileCopy] '${arg.sourceFilePath}' -> '${arg.destinationFilePath}'`);
    const stat = await fsp.lstat(arg.sourceFilePath);
    if (stat.isDirectory()) {
      await copyDir(arg.sourceFilePath, arg.destinationFilePath);
      await chmodDir(arg.destinationFilePath, DEFAULT_FILE_MODE);
    } else {
      await fsp.copyFile(arg.sourceFilePath, arg.destinationFilePath);
      await fsp.chmod(arg.destinationFilePath, DEFAULT_FILE_MODE);
    }
    return true;
  });

  handle(IPC_DELETE_DIRECTORY_CHANNEL, async (evt, filePath: string) => {
    log.info(`[FileRemove] ${filePath}`);
    return await remove(filePath);
  });

  handle(IPC_READ_FILE_CHANNEL, async (evt, filePath: string) => {
    return await fsp.readFile(filePath, { encoding: "utf-8" });
  });

  handle(IPC_READ_FILE_BUFFER_CHANNEL, async (evt, filePath: string) => {
    return await fsp.readFile(filePath);
  });

  handle("decode-product-db", async (evt, filePath: string) => {
    const productDbData = await fsp.readFile(filePath);
    const productDb = ProductDb.decode(productDbData);
    setImmediate(() => {
      console.log("productDb", JSON.stringify(productDb));
    });

    return productDb;
  });

  handle(IPC_WRITE_FILE_CHANNEL, async (evt, filePath: string, contents: string) => {
    return await fsp.writeFile(filePath, contents, { encoding: "utf-8", mode: DEFAULT_FILE_MODE });
  });

  handle(IPC_CREATE_TRAY_MENU_CHANNEL, (evt, config: SystemTrayConfig) => {
    return createTray(window, config);
  });

  handle(IPC_CREATE_APP_MENU_CHANNEL, (evt, config: MenuConfig) => {
    return createAppMenu(window, config);
  });

  handle(IPC_GET_LATEST_DIR_UPDATE_TIME, (evt, dirPath: string) => {
    return getLastModifiedFileDate(dirPath);
  });

  handle(IPC_LIST_DIR_RECURSIVE, (evt, dirPath: string): Promise<string[]> => {
    return readDirRecursive(dirPath);
  });

  handle(IPC_GET_DIRECTORY_TREE, (evt, args: GetDirectoryTreeRequest): Promise<TreeNode> => {
    log.debug(IPC_GET_DIRECTORY_TREE, args);
    return getDirTree(args.dirPath, args.opts);
  });

  handle(IPC_GET_HOME_DIR, (): string => {
    return os.homedir();
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

  ipcMain.handle(IPC_WINDOW_IS_MAXIMIZED, () => {
    return window?.isMaximized() ?? false;
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

  ipcMain.handle(IPC_WINDOW_IS_FULLSCREEN, () => {
    return window?.isFullScreen() ?? false;
  });

  handle(IPC_SHOW_OPEN_DIALOG, async (evt, options: OpenDialogOptions) => {
    return await dialog.showOpenDialog(options);
  });

  handle(IPC_PUSH_INIT, () => {
    return push.startPushService();
  });

  handle(IPC_PUSH_REGISTER, async (evt, appId: string) => {
    return await push.registerForPush(appId);
  });

  handle(IPC_PUSH_UNREGISTER, async () => {
    return await push.unregisterPush();
  });

  handle(IPC_PUSH_SUBSCRIBE, async (evt, channel: string) => {
    return await push.subscribeToChannel(channel);
  });

  handle("get-focus", () => {
    return window.isFocused();
  });

  ipcMain.on(IPC_DOWNLOAD_FILE_CHANNEL, (evt, arg: DownloadRequest) => {
    handleDownloadFile(arg).catch((e) => log.error(e.toString()));
  });

  // In order to allow concurrent downloads, we have to get creative with this session handler
  window.webContents.session.on("will-download", (evt, item, wc) => {
    for (const key of _dlMap.keys()) {
      log.info(`will-download: ${key}`);
      if (!item.getURLChain().includes(key)) {
        continue;
      }

      try {
        const action = _dlMap.get(key);
        action.call(null, evt, item, wc);
      } catch (e) {
        log.error(e);
      } finally {
        _dlMap.delete(key);
      }
    }
  });

  async function statFile(filePath: string) {
    const stats = await fsp.stat(filePath);
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
    return { path: filePath, fsStats };
  }

  async function handleDownloadFile(arg: DownloadRequest) {
    const status: DownloadStatus = {
      type: DownloadStatusType.Pending,
      savePath: "",
    };

    try {
      await fsp.mkdir(arg.outputFolder, { recursive: true });

      const downloadUrl = new URL(arg.url);
      if (typeof arg.auth?.queryParams === "object") {
        for (const [key, value] of Object.entries(arg.auth.queryParams)) {
          downloadUrl.searchParams.set(key, value);
        }
      }

      const savePath = path.join(arg.outputFolder, `${nanoid()}-${arg.fileName}`);
      log.info(`[DownloadFile] '${downloadUrl.toString()}' -> '${savePath}'`);

      const url = downloadUrl.toString();
      const writer = fs.createWriteStream(savePath);

      try {
        await new Promise((resolve, reject) => {
          let size = 0;
          let percentMod = -1;

          const req = net.request({
            url,
            redirect: "manual",
          });

          if (typeof arg.auth?.headers === "object") {
            for (const [key, value] of Object.entries(arg.auth.headers)) {
              log.info(`Setting header: ${key}=${value}`);
              req.setHeader(key, value);
            }
          }

          req.on("redirect", (status, method, redirectUrl) => {
            log.info(`[download] caught redirect`, status, redirectUrl);
            req.followRedirect();
          });

          req.on("response", (response) => {
            const fileLength = parseInt((response.headers["content-length"] as string) ?? "0", 10);

            response.on("data", (data) => {
              writer.write(data, () => {
                size += data.length;
                const percent = fileLength <= 0 ? 0 : Math.floor((size / fileLength) * 100);
                if (percent % 5 === 0 && percentMod !== percent) {
                  percentMod = percent;
                  log.debug(`Write: [${percent}] ${size}`);
                }
              });
            });

            response.on("end", () => {
              if (response.statusCode < 200 || response.statusCode >= 300) {
                return reject(new Error(`Invalid response (${response.statusCode}): ${url}`));
              }

              return resolve(undefined);
            });
            response.on("error", (err) => {
              return reject(err);
            });
          });
          req.end();
        });
      } finally {
        // always close stream
        writer.end();
      }

      status.type = DownloadStatusType.Complete;
      status.savePath = savePath;

      window.webContents.send(arg.responseKey, status);
    } catch (err) {
      log.error(err);
      status.type = DownloadStatusType.Error;
      status.error = err;
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
      reject(error);
    });

    zipfile.readEntry();
    zipfile.on("entry", function (entry: yauzl.Entry) {
      if (/\/$/.test(entry.fileName)) {
        // directory file names end with '/'
        const dirPath = path.join(targetDir, entry.fileName);
        fs.mkdir(dirPath, { recursive: true }, function () {
          if (err) throw err;
          zipfile.readEntry();
        });
      } else {
        // ensure parent directory exists
        const filePath = path.join(targetDir, entry.fileName);
        const parentPath = path.join(targetDir, path.dirname(entry.fileName));
        fs.mkdir(parentPath, { recursive: true }, function () {
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
