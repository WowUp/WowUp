import { Injectable } from "@angular/core";
import { v4 as uuidv4 } from "uuid";
import {
  IPC_COPY_FILE_CHANNEL,
  IPC_CREATE_DIRECTORY_CHANNEL,
  IPC_DELETE_DIRECTORY_CHANNEL,
  IPC_GET_HOME_DIR,
  IPC_GET_ASSET_FILE_PATH,
  IPC_LIST_DIRECTORIES_CHANNEL,
  IPC_PATH_EXISTS_CHANNEL,
  IPC_READ_FILE_CHANNEL,
  IPC_WRITE_FILE_CHANNEL,
  IPC_SHOW_DIRECTORY,
  IPC_STAT_FILES_CHANNEL,
  IPC_UNZIP_FILE_CHANNEL,
  IPC_LIST_ENTRIES,
  IPC_LIST_FILES_CHANNEL,
  IPC_READDIR,
  IPC_READ_FILE_BUFFER_CHANNEL,
  IPC_GET_LATEST_DIR_UPDATE_TIME,
  IPC_LIST_DIR_RECURSIVE,
  IPC_GET_DIRECTORY_TREE,
  DEFAULT_FILE_MODE,
} from "../../../common/constants";
import { CopyFileRequest } from "../../../common/models/copy-file-request";
import { UnzipRequest } from "../../../common/models/unzip-request";
import { FsDirent, FsStats, TreeNode } from "../../../common/models/ipc-events";
import { ElectronService } from "../electron/electron.service";
import { GetDirectoryTreeOptions, GetDirectoryTreeRequest } from "../../../common/models/ipc-request";
import { ZipEntry } from "../../../common/models/ipc-response";

@Injectable({
  providedIn: "root",
})
export class FileService {
  public constructor(private _electronService: ElectronService) {}

  public getHomeDir(): Promise<string> {
    return this._electronService.invoke(IPC_GET_HOME_DIR);
  }

  public getAssetFilePath(fileName: string): Promise<string> {
    return this._electronService.invoke<string>(IPC_GET_ASSET_FILE_PATH, fileName);
  }

  public createDirectory(directoryPath: string): Promise<boolean> {
    return this._electronService.invoke<boolean>(IPC_CREATE_DIRECTORY_CHANNEL, directoryPath);
  }

  public showDirectory(sourceDir: string): Promise<string> {
    return this._electronService.invoke<string>(IPC_SHOW_DIRECTORY, sourceDir);
  }

  public pathExists(sourcePath: string): Promise<boolean> {
    return this._electronService.invoke(IPC_PATH_EXISTS_CHANNEL, sourcePath);
  }

  /**
   * Delete a file or directory
   */
  public async remove(sourcePath: string): Promise<boolean> {
    if (!sourcePath) {
      throw new Error("remove sourcePath required");
    }

    return await this._electronService.invoke(IPC_DELETE_DIRECTORY_CHANNEL, sourcePath);
  }

  public async removeAll(...sourcePaths: string[]): Promise<boolean> {
    if (!Array.isArray(sourcePaths) || !sourcePaths.length) {
      return false;
    }

    const results = await Promise.all(
      sourcePaths.map((sp) => {
        console.log(`[RemovePath]: ${sp}`);
        return this._electronService.invoke(IPC_DELETE_DIRECTORY_CHANNEL, sp);
      })
    );

    return results.every((r) => r === true);
  }

  public async removeAllSafe(...sourcePaths: string[]): Promise<boolean> {
    try {
      return await this.removeAll(...sourcePaths);
    } catch (e) {
      console.error(`Failed to remove all`, sourcePaths, e);
      return false;
    }
  }

  /**
   * Copy a file or folder
   */
  public async copy(
    sourceFilePath: string,
    destinationFilePath: string,
    destinationFileChmod: string | number = DEFAULT_FILE_MODE
  ): Promise<string> {
    const request: CopyFileRequest = {
      sourceFilePath,
      destinationFilePath,
      destinationFileChmod,
      responseKey: uuidv4(),
    };

    await this._electronService.invoke(IPC_COPY_FILE_CHANNEL, request);

    return destinationFilePath;
  }

  public async deleteIfExists(filePath: string): Promise<void> {
    const pathExists = await this.pathExists(filePath);
    if (pathExists) {
      await this.remove(filePath);
    }
  }

  public async readFile(sourcePath: string): Promise<string> {
    return await this._electronService.invoke(IPC_READ_FILE_CHANNEL, sourcePath);
  }

  public async readFileBuffer(sourcePath: string): Promise<Buffer> {
    return await this._electronService.invoke(IPC_READ_FILE_BUFFER_CHANNEL, sourcePath);
  }

  /** Returns the time in ms of the last updated file in a folder */
  public async getLatestDirUpdateTime(dirPath: string): Promise<number> {
    return await this._electronService.invoke(IPC_GET_LATEST_DIR_UPDATE_TIME, dirPath);
  }

  public async listDirectoryRecursive(dirPath: string): Promise<string[]> {
    return await this._electronService.invoke(IPC_LIST_DIR_RECURSIVE, dirPath);
  }

  public async getDirectoryTree(dirPath: string, opts?: GetDirectoryTreeOptions): Promise<TreeNode> {
    const request: GetDirectoryTreeRequest = {
      dirPath,
      opts,
    };
    return await this._electronService.invoke(IPC_GET_DIRECTORY_TREE, request);
  }

  public async writeFile(sourcePath: string, contents: string): Promise<string> {
    return await this._electronService.invoke(IPC_WRITE_FILE_CHANNEL, sourcePath, contents);
  }

  public async listDirectories(sourcePath: string, scanSymlinks = false): Promise<string[]> {
    return await this._electronService.invoke(IPC_LIST_DIRECTORIES_CHANNEL, sourcePath, scanSymlinks);
  }

  public readdir(dirPath: string): Promise<string[]> {
    return this._electronService.invoke(IPC_READDIR, dirPath);
  }

  public statFiles(filePaths: string[]): Promise<{ [path: string]: FsStats }> {
    return this._electronService.invoke(IPC_STAT_FILES_CHANNEL, filePaths);
  }

  public listEntries(sourcePath: string, filter: string): Promise<FsDirent[]> {
    return this._electronService.invoke<FsDirent[]>(IPC_LIST_ENTRIES, sourcePath, filter);
  }

  public listFiles(sourcePath: string, filter: string): Promise<string[]> {
    return this._electronService.invoke<string[]>(IPC_LIST_FILES_CHANNEL, sourcePath, filter);
  }

  public listZipFiles(sourcePath: string, filter: string): Promise<ZipEntry[]> {
    return this._electronService.invoke<ZipEntry[]>("zip-list-files", sourcePath, filter);
  }

  public readFileInZip(zipPath: string, filePath: string): Promise<string> {
    return this._electronService.invoke<string>("zip-read-file", zipPath, filePath);
  }

  public async unzipFile(zipFilePath: string, outputFolder: string): Promise<string> {
    console.log("unzipFile", zipFilePath);

    const request: UnzipRequest = {
      outputFolder,
      zipFilePath,
      responseKey: uuidv4(),
    };

    return await this._electronService.invoke(IPC_UNZIP_FILE_CHANNEL, request);
  }

  public async zipFile(srcPath: string, destPath: string): Promise<void> {
    await this._electronService.invoke("zip-file", srcPath, destPath);
  }

  public async renameFile(srcPath: string, destPath: string): Promise<void> {
    await this._electronService.invoke("rename-file", srcPath, destPath);
  }
}
