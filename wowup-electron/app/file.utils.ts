import { exec } from "child_process";
import * as log from "electron-log";
import * as fsp from "fs/promises";
import { max, sumBy } from "lodash";
import * as path from "path";
import * as crypto from "crypto";
import * as AdmZip from "adm-zip";
import * as globrex from "globrex";

import { TreeNode } from "../src/common/models/ipc-events";
import { GetDirectoryTreeOptions } from "../src/common/models/ipc-request";
import { isWin } from "./platform";
import { ZipEntry } from "../src/common/models/ipc-response";

export function zipFile(srcPath: string, outPath: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const zip = new AdmZip();
    zip.addLocalFolder(srcPath);

    zip.writeZip(outPath, (e) => {
      return e ? reject(e) : resolve(true);
    });
  });
}

export function readFileInZip(zipPath: string, filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const zip = new AdmZip(zipPath);
    zip.readAsTextAsync(filePath, (data, err) => {
      return err ? reject(err) : resolve(data);
    });
  });
}

export function listZipFiles(zipPath: string, filter: string): ZipEntry[] {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  const globFilter = globrex(filter);
  const matches = entries.filter((entry) => globFilter.regex.test(entry.name));

  return matches.map((entry) => {
    return {
      isDirectory: entry.isDirectory,
      name: entry.name,
      path: entry.entryName,
    };
  });
}

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

export async function getDirTree(sourcePath: string, opts?: GetDirectoryTreeOptions): Promise<TreeNode> {
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
      const nestedNode = await getDirTree(filePath, opts);
      node.children.push(nestedNode);
      node.size = sumBy(node.children, (n) => n.size);
      if (opts?.includeHash) {
        node.hash = hashString(node.children.map((n) => n.hash).join(""), "sha256");
      }
    } else {
      let hash = "";
      if (opts?.includeHash) {
        hash = await hashFile(filePath, "sha256");
      }

      const stats = await fsp.stat(filePath);
      node.size += stats.size;
      node.children.push({
        name: file.name,
        path: filePath,
        children: [],
        isDirectory: false,
        size: stats.size,
        hash,
      });
    }
  }

  if (opts?.includeHash) {
    node.hash = hashString(node.children.map((n) => n.hash).join(""), "sha256");
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

export function hashString(str: string | crypto.BinaryLike, alg = "md5"): string {
  const md5 = crypto.createHash(alg);
  md5.update(str);
  return md5.digest("hex");
}

export async function hashFile(filePath: string, alg = "md5"): Promise<string> {
  const text = await fsp.readFile(filePath);
  return hashString(text, alg);
}
