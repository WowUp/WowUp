import * as fs from "fs";
import * as path from "path";
import * as log from "electron-log";
import { promisify } from "util";
import { max, sumBy } from "lodash";
import { TreeNode } from "../src/common/models/ipc-events";

export const fsReaddir = promisify(fs.readdir);
export const fsRmdir = promisify(fs.rmdir);
export const fsStat = promisify(fs.stat);
export const fsLstat = promisify(fs.lstat);
export const fsRealpath = promisify(fs.realpath);
export const fsMkdir = promisify(fs.mkdir);
export const fsAccess = promisify(fs.access);
export const fsCopyFile = promisify(fs.copyFile);
export const fsChmod = promisify(fs.chmod);
export const fsUnlink = promisify(fs.unlink);
export const fsReadFile = promisify(fs.readFile);
export const fsWriteFile = promisify(fs.writeFile);

export async function exists(path: string): Promise<boolean> {
  try {
    await fsAccess(path);
    return true;
  } catch (e) {
    log.warn(`File does not exist: ${path}`);
    log.warn(e.message);
    return false;
  }
}

export async function copyDir(src: string, dest: string): Promise<void> {
  await fsMkdir(dest, { recursive: true });
  const entries = await fsReaddir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    entry.isDirectory() ? await copyDir(srcPath, destPath) : await fsCopyFile(srcPath, destPath);
  }
}

export async function remove(path: string): Promise<void> {
  const stat = await fsStat(path);
  if (stat.isDirectory()) {
    await fsRmdir(path, { recursive: true });
  } else {
    await fsUnlink(path);
  }
}

export async function readDirRecursive(sourcePath: string): Promise<string[]> {
  const dirFiles: string[] = [];
  const files = await fsReaddir(sourcePath, { withFileTypes: true });

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
  const files = await fsReaddir(sourcePath, { withFileTypes: true });

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
      const stats = await fsStat(filePath);
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
    const stat = await fsStat(file);
    dates.push(stat.mtimeMs);
  }

  const latest = max(dates);
  return latest;
}
