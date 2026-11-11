import * as log from "electron-log/main";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import { AddonFolder, FsStats, Toc, WowInstallation } from "wowup-lib-core";

import { WOW_ADDON_FOLDER_NAME, WOW_INTERFACE_FOLDER_NAME } from "../../../src/common/constants";
import { exists } from "../../file.utils";
import { TocService } from "../toc/toc.service";

/** An installation's addon folders on disk, each with its parsed tocs */
export class AddonFolderService {
  public constructor(private readonly tocService: TocService) {}

  /** Same rule as the renderer's WarcraftService.getAddonFolderPath */
  public getAddonFolderPath(installation: WowInstallation): string {
    return path.join(path.dirname(installation.location), WOW_INTERFACE_FOLDER_NAME, WOW_ADDON_FOLDER_NAME);
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
