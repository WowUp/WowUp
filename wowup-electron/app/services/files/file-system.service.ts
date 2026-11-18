import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import globrex = require("globrex");
import { firstValueFrom, from, mergeMap, toArray } from "rxjs";
import type { FsStats } from "wowup-lib-core";

import type { FsDirent } from "../../../src/common/models/ipc-events";

export interface FileSystemLogger {
  error: (...args: unknown[]) => void;
}

const STAT_CONCURRENCY = 3;

/** The directory listing and stat calls the renderer asks main for, plus main's own addon folder listing */
export class FileSystemService {
  public constructor(private readonly _log: FileSystemLogger) {}

  /** Names of the folders directly in `dirPath`; with `scanSymlinks`, also the links that resolve to a folder */
  public async listDirectories(dirPath: string, scanSymlinks = false): Promise<string[]> {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });

    const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    if (!scanSymlinks) {
      return directories;
    }

    return [...directories, ...(await this.getSymlinkDirNames(dirPath, entries))];
  }

  public async statPath(filePath: string): Promise<FsStats> {
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

  /** Stats keyed by path; any path that can't be stat'd fails the whole call */
  public async statFiles(filePaths: string[]): Promise<{ [path: string]: FsStats }> {
    const results = await firstValueFrom(
      from(filePaths).pipe(
        mergeMap(async (filePath) => ({ filePath, stats: await this.statPath(filePath) }), STAT_CONCURRENCY),
        toArray(),
      ),
    );

    const byPath: { [path: string]: FsStats } = {};
    for (const { filePath, stats } of results) {
      byPath[filePath] = stats;
    }
    return byPath;
  }

  /** Entries directly in `dirPath` whose name matches the glob `filter` */
  public async listEntries(dirPath: string, filter: string): Promise<FsDirent[]> {
    return (await this.readMatching(dirPath, filter)).map((entry) => ({
      isBlockDevice: entry.isBlockDevice(),
      isCharacterDevice: entry.isCharacterDevice(),
      isDirectory: entry.isDirectory(),
      isFIFO: entry.isFIFO(),
      isFile: entry.isFile(),
      isSocket: entry.isSocket(),
      isSymbolicLink: entry.isSymbolicLink(),
      name: entry.name,
    }));
  }

  /** Names directly in `dirPath` matching the glob `filter`; none if the folder isn't there */
  public async listFiles(dirPath: string, filter: string): Promise<string[]> {
    if (!(await this.pathExists(dirPath))) {
      return [];
    }

    return (await this.readMatching(dirPath, filter)).map((entry) => entry.name);
  }

  public async pathExists(filePath: string): Promise<boolean> {
    if (!filePath) {
      return false;
    }

    try {
      await fsp.access(filePath);
      return true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
        this._log.error(e);
      }
      return false;
    }
  }

  private async readMatching(dirPath: string, filter: string): Promise<fs.Dirent[]> {
    const globFilter = globrex(filter);
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => globFilter.regex.test(entry.name));
  }

  private async getSymlinkDirNames(basePath: string, entries: fs.Dirent[]): Promise<string[]> {
    const names: string[] = [];

    for (const symlink of entries.filter((entry) => entry.isSymbolicLink())) {
      const realPath = await fsp.realpath(path.join(basePath, symlink.name));
      if ((await fsp.lstat(realPath)).isDirectory()) {
        names.push(symlink.name);
      }
    }

    return names;
  }
}
