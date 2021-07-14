import * as fs from "fs-extra";
import * as path from "path";
import { max, sumBy } from "lodash";
import { TreeNode } from "../src/common/models/ipc-events";

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

export async function getDirTree(sourcePath: string): Promise<TreeNode> {
  const files = await fs.readdir(sourcePath, { withFileTypes: true });

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
      const stats = await fs.stat(filePath);
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
    const stat = await fs.stat(file);
    dates.push(stat.mtimeMs);
  }

  const latest = max(dates);
  return latest;
}
