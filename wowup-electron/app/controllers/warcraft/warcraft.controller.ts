import * as Store from "electron-store";
import * as log from "electron-log/main";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";

import {
  BLIZZARD_AGENT_PATH_KEY,
  IPC_WARCRAFT_GET_ADDON_FOLDER,
  IPC_WARCRAFT_GET_BLIZZARD_AGENT_PATH,
  IPC_WARCRAFT_GET_CLIENT_TYPE_FOR_BINARY,
  IPC_WARCRAFT_GET_EXECUTABLE_EXTENSION,
  IPC_WARCRAFT_GET_EXECUTABLE_NAME,
  IPC_WARCRAFT_GET_INSTALLED_PRODUCTS,
  IPC_WARCRAFT_IS_WOW_APPLICATION,
  IPC_WARCRAFT_LIST_ADDONS,
} from "../../../src/common/constants";
import { AddonFolder, FsStats, InstalledProduct, Toc, WowClientType } from "wowup-lib-core";

import { exists } from "../../file.utils";
import { ipcHandle, IpcController } from "../ipc-controller";
import { TocService } from "../../services/toc/toc.service";
import { decodeProducts, WarcraftPlatform } from "../../services/warcraft/warcraft-platform.service";

export class WarcraftController implements IpcController {
  public constructor(
    private readonly platform: WarcraftPlatform,
    private readonly prefStore: Store,
    private readonly tocService: TocService,
  ) {}

  public register(): void {
    ipcHandle(IPC_WARCRAFT_GET_BLIZZARD_AGENT_PATH, () => this.getBlizzardAgentPath());
    ipcHandle(IPC_WARCRAFT_GET_INSTALLED_PRODUCTS, (_evt, agentPath: string) => this.getInstalledProducts(agentPath));
    ipcHandle(IPC_WARCRAFT_GET_EXECUTABLE_NAME, (_evt, clientType: WowClientType) =>
      this.platform.getExecutableName(clientType),
    );
    ipcHandle(IPC_WARCRAFT_GET_CLIENT_TYPE_FOR_BINARY, (_evt, binaryPath: string) =>
      this.platform.getClientType(binaryPath),
    );
    ipcHandle(IPC_WARCRAFT_IS_WOW_APPLICATION, (_evt, appName: string) => this.platform.isWowApplication(appName));
    ipcHandle(IPC_WARCRAFT_GET_EXECUTABLE_EXTENSION, () => this.platform.getExecutableExtension());
    ipcHandle(IPC_WARCRAFT_LIST_ADDONS, (_evt, addonFolderPath: string, scanSymlinks: boolean) =>
      this.listAddons(addonFolderPath, scanSymlinks),
    );
    ipcHandle(IPC_WARCRAFT_GET_ADDON_FOLDER, (_evt, addonFolderPath: string, dir: string) =>
      this.getAddonFolder(addonFolderPath, dir),
    );
  }

  public async getBlizzardAgentPath(): Promise<string> {
    const stored = this.prefStore.get(BLIZZARD_AGENT_PATH_KEY) as string | undefined;
    if (stored) {
      return stored;
    }

    const agentPath = await this.platform.getBlizzardAgentPath();
    if (agentPath) {
      this.prefStore.set(BLIZZARD_AGENT_PATH_KEY, agentPath);
    }

    return agentPath;
  }

  public async getInstalledProducts(agentPath: string): Promise<Map<WowClientType, InstalledProduct>> {
    const decoded = await decodeProducts(agentPath);
    const resolved = this.platform.resolveProducts(decoded, agentPath);

    const result = new Map<WowClientType, InstalledProduct>();
    for (const product of resolved) {
      result.set(product.clientType, product);
    }
    return result;
  }

  public async listAddons(addonFolderPath: string, scanSymlinks = false): Promise<AddonFolder[]> {
    const addonFolders: AddonFolder[] = [];

    const addonFolderExists = await exists(addonFolderPath);
    if (!addonFolderExists) {
      return addonFolders;
    }

    const directories = await this.listDirectoryNames(addonFolderPath, scanSymlinks);

    for (const dir of directories) {
      const addonFolder = await this.getAddonFolder(addonFolderPath, dir);
      if (!addonFolder) {
        log.warn(`Failed to get addonFolder, no toc found: ${dir}`);
        continue;
      }

      addonFolder.fileStats = await this.statPath(path.join(addonFolderPath, dir));
      addonFolders.push(addonFolder);
    }

    return addonFolders;
  }

  public async getAddonFolder(addonFolderPath: string, dir: string): Promise<AddonFolder | undefined> {
    try {
      const dirPath = path.join(addonFolderPath, dir);
      const dirFiles = await fsp.readdir(dirPath);
      const tocFiles = dirFiles.filter((f) => path.extname(f) === ".toc");
      if (tocFiles.length === 0) {
        return undefined;
      }

      const tocs: Toc[] = [];
      for (const tocFile of tocFiles) {
        const tocPath = path.join(dirPath, tocFile);
        const toc = await this.tocService.parse(tocPath);
        tocs.push(toc);
      }

      return {
        name: dir,
        path: dirPath,
        status: "Pending",
        tocs,
      };
    } catch (e) {
      log.error(e);
      return undefined;
    }
  }

  private async listDirectoryNames(dirPath: string, scanSymlinks: boolean): Promise<string[]> {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });

    let symlinkNames: string[] = [];
    if (scanSymlinks) {
      symlinkNames = await this.getSymlinkDirNames(dirPath, entries);
    }

    const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    return [...directories, ...symlinkNames];
  }

  private async getSymlinkDirNames(basePath: string, entries: fs.Dirent[]): Promise<string[]> {
    const symlinks = entries.filter((entry) => entry.isSymbolicLink());
    const names: string[] = [];

    for (const symlink of symlinks) {
      const realPath = await fsp.realpath(path.join(basePath, symlink.name));
      const stat = await fsp.lstat(realPath);
      if (stat.isDirectory()) {
        names.push(symlink.name);
      }
    }

    return names;
  }

  private async statPath(filePath: string): Promise<FsStats> {
    const stats = await fsp.stat(filePath);
    return {
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
  }
}
