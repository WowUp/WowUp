import * as fs from "fs";
import * as path from "path";

export async function readDirRecursive(sourcePath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const dirFiles: string[] = [];
    fs.readdir(sourcePath, { withFileTypes: true }, async (err, files) => {
      if (err) {
        return reject(err);
      }

      for (let file of files) {
        const filePath = path.join(sourcePath, file.name);
        if (file.isDirectory()) {
          const nestedFiles = await readDirRecursive(filePath);
          dirFiles.push(...nestedFiles);
        } else {
          dirFiles.push(filePath);
        }
      }

      resolve(dirFiles);
    });
  });
}

export function readFile(sourcePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(sourcePath, { encoding: "utf-8" }, (err, data) => {
      if (err) {
        return reject(err);
      }
      return resolve(data);
    });
  });
}

export function readFileAsBuffer(sourcePath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    fs.readFile(sourcePath, {}, (err, data) => {
      if (err) {
        return reject(err);
      }
      return resolve(data);
    });
  });
}
