import * as fs from "fs-extra";
import * as path from "path";
import { max } from "lodash";

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
