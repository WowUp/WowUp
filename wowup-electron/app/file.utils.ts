import { exec } from 'child_process';
import * as log from 'electron-log';
import * as fsp from 'fs/promises';
import { max, sumBy } from 'lodash';
import * as path from 'path';

import { TreeNode } from '../src/common/models/ipc-events';
import { isWin } from './platform';

export async function exists(path: string): Promise<boolean> {
  try {
    await fsp.access(path);
    return true;
  } catch (e) {
    log.warn(`File does not exist: ${path}`);
    log.warn(e.message);
    return false;
  }
}

export async function chmodDir(dirPath: string, mode: number | string): Promise<void> {
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      await chmodDir(srcPath, mode);
    } else {
      await fsp.chmod(srcPath, mode);
    }
  }
}

export async function copyDir(src: string, dest: string): Promise<void> {
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fsp.copyFile(srcPath, destPath);
    }
  }
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

export async function readDirRecursive(sourcePath: string): Promise<string[]> {
  const dirFiles: string[] = [];
  const files = await fsp.readdir(sourcePath, { withFileTypes: true });

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

export async function getDirTree(sourcePath: string): Promise<TreeNode> {
  const files = await fsp.readdir(sourcePath, { withFileTypes: true });

  const node: TreeNode = {
    name: path.basename(sourcePath),
    path: sourcePath,
    children: [],
    isDirectory: true,
    size: 0,
  };

  for (const file of files) {
    const filePath = path.join(sourcePath, file.name);
    if (file.isDirectory()) {
      const nestedNode = await getDirTree(filePath);
      node.children.push(nestedNode);
      node.size = sumBy(node.children, (n) => n.size);
    } else {
      const stats = await fsp.stat(filePath);
      node.size += stats.size;
      node.children.push({
        name: file.name,
        path: filePath,
        children: [],
        isDirectory: false,
        size: stats.size,
      });
    }
  }

  return node;
}

export async function getLastModifiedFileDate(sourcePath: string): Promise<number> {
  const dirFiles = await readDirRecursive(sourcePath);
  const dates: number[] = [];
  for (const file of dirFiles) {
    const stat = await fsp.stat(file);
    dates.push(stat.mtimeMs);
  }

  const latest = max(dates);
  return latest;
}
