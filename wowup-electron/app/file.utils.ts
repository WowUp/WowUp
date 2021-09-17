import { exec } from "child_process";
import * as log from "electron-log";
import * as fs from "fs-extra";
import * as fsp from "fs/promises";
import { max } from "lodash";
import * as path from "path";

import { isWin } from "./platform";

export async function readDirRecursive(sourcePath: string): Promise<string[]> {
  const dirFiles: string[] = [];
  const files = await fs.readdir(sourcePath, { withFileTypes: true });

  for (const file of files) {
    const filePath = path.join(sourcePath, file.name);
    if (file.isDirectory()) {
      const nestedFiles = await readDirRecursive(filePath);
      dirFiles.push(...nestedFiles);
    } else {
      dirFiles.push(filePath);
    }
  }

  return dirFiles;
}

export async function getLastModifiedFileDate(sourcePath: string): Promise<number> {
  const dirFiles = await readDirRecursive(sourcePath);
  const dates: number[] = [];
  for (const file of dirFiles) {
    const stat = await fs.stat(file);
    dates.push(stat.mtimeMs);
  }

  const latest = max(dates);
  return latest;
}

export async function remove(path: string): Promise<void> {
  const stat = await fsp.stat(path);
  if (stat.isDirectory()) {
    await rmdir(path);
  } else {
    await fsp.unlink(path);
  }
}

/**
 * On Windows, users that use the Google Drive sync tool are unable to delete any folders.
 * Seems to be a node issue that it cannot delete even empty folders synced by this tool.
 * However, if you use CMD to delete the folder it works fine?
 */
async function rmdir(path: string): Promise<void> {
  if (isWin) {
    await new Promise((resolve, reject) => {
      exec(`rmdir "${path}" /s /q`, (err, stdout, stderr) => {
        if (err || stdout.length || stderr.length) {
          log.error("rmdir fallback failed", err, stdout, stderr);
          return reject(new Error("rmdir fallback failed"));
        }
        resolve(undefined);
      });
    });
  } else {
    await fsp.rm(path, { recursive: true, force: true });
  }
}
