import { Injectable } from "@angular/core";
import { v4 as uuidv4 } from "uuid";
import {
  IPC_COPY_FILE_CHANNEL,
  IPC_CREATE_DIRECTORY_CHANNEL,
  IPC_DELETE_DIRECTORY_CHANNEL,
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
} from "../../../common/constants";
import { CopyFileRequest } from "../../../common/models/copy-file-request";
import { UnzipRequest } from "../../../common/models/unzip-request";
import { FsDirent, FsStats } from "../../../common/models/ipc-events";
import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class FileService {
  constructor(private _electronService: ElectronService) {}

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

  /**
   * Copy a file or folder
   */
  public async copy(sourceFilePath: string, destinationFilePath: string): Promise<string> {
    const request: CopyFileRequest = {
      destinationFilePath,
      sourceFilePath,
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

  public async writeFile(sourcePath: string, contents: string): Promise<string> {
    return await this._electronService.invoke(IPC_WRITE_FILE_CHANNEL, sourcePath, contents);
  }

  public async listDirectories(sourcePath: string): Promise<string[]> {
    return await this._electronService.invoke(IPC_LIST_DIRECTORIES_CHANNEL, sourcePath);
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

  public async unzipFile(zipFilePath: string, outputFolder: string): Promise<string> {
    console.log("unzipFile", zipFilePath);

    const request: UnzipRequest = {
      outputFolder,
      zipFilePath,
      responseKey: uuidv4(),
    };

    return await this._electronService.invoke(IPC_UNZIP_FILE_CHANNEL, request);
  }
}
