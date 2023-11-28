import * as fs from "fs";
import { join } from "path";
import * as log from "electron-log/main";

/**
 * There appears to be some issue with Ubuntu and the GPUCache system of electron
 * https://github.com/WowUp/WowUp.CF/issues/63
 *
 * User from an app with similar issue discovered deleting the folder and letting the app rebuild it appears to fix it.
 * https://github.com/ferdium/ferdium-app/issues/1265
 *
 * Added in a version file to the GPU cache folder that should get checked and delete the folder before the initial
 * cache is generated hopefully fixing this issue
 */

const GPU_CACHE_FOLDER = "GPUCache";
const GPU_VERSION_FILE = ".wuversion";

interface VersionFileData {
  version: string;
}

export function validateGpuCache(app: Electron.App) {
  try {
    const cacheDir = join(app.getPath("userData"), GPU_CACHE_FOLDER);
    const cacheExists = fileExists(cacheDir);
    if (cacheExists) {
      const files = fs.readdirSync(cacheDir);
      const verFile = files.find((f) => f === GPU_VERSION_FILE);
      if (verFile === undefined) {
        removeDir(cacheDir);
      } else {
        const verFile = readVersionFile(cacheDir);
        if (verFile.version !== app.getVersion()) {
          removeDir(cacheDir);
        } else {
          return;
        }
      }
    }

    fs.mkdirSync(cacheDir);
    createVersionFile(app.getVersion(), cacheDir);
  } catch (e) {
    log.error("failed to validate GPU Cache", e);
  }
  // app.relaunch();
}

function removeDir(path: string) {
  fs.rmSync(path, { force: true, recursive: true });
}

function fileExists(path: string) {
  try {
    fs.accessSync(path);
    return true;
  } catch (e) {
    log.warn(`File does not exist: ${path}`);
    log.warn(e.message);
    return false;
  }
}

function readVersionFile(cacheDir: string): VersionFileData {
  const filePath = join(cacheDir, GPU_VERSION_FILE);
  const fileData = fs.readFileSync(filePath, { encoding: "utf-8" });
  const versionData: VersionFileData = JSON.parse(fileData);
  return versionData;
}

function createVersionFile(version: string, cacheDir: string) {
  const versionData: VersionFileData = {
    version,
  };

  const filePath = join(cacheDir, GPU_VERSION_FILE);
  const verFileData = JSON.stringify(versionData);

  fs.writeFileSync(filePath, verFileData, { encoding: "utf-8" });
}
