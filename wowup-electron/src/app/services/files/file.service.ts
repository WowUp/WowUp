import { Injectable } from "@angular/core";
import * as fs from "fs";
import * as globrex from "globrex";
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
} from "../../../common/constants";
import { CopyFileRequest } from "../../../common/models/copy-file-request";
import { UnzipRequest } from "../../../common/models/unzip-request";
import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class FileService {
  constructor(private _electronService: ElectronService) {}

  public async getAssetFilePath(fileName: string) {
    return await this._electronService.invoke(IPC_GET_ASSET_FILE_PATH, fileName);
  }

  public async createDirectory(directoryPath: string) {
    return await this._electronService.invoke(IPC_CREATE_DIRECTORY_CHANNEL, directoryPath);
  }

  public async showDirectory(sourceDir: string) {
    return await this._electronService.invoke(IPC_SHOW_DIRECTORY, sourceDir);
  }

  public async pathExists(sourcePath: string): Promise<boolean> {
    if (!sourcePath) {
      return Promise.resolve(false);
    }

    return await this._electronService.invoke(IPC_PATH_EXISTS_CHANNEL, sourcePath);
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

  public async deleteIfExists(filePath: string) {
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

  public async statFiles(filePaths: string[]): Promise<{ [path: string]: fs.Stats }> {
    return await this._electronService.invoke(IPC_STAT_FILES_CHANNEL, filePaths);
  }

  public listEntries(sourcePath: string, filter: string) {
    const globFilter = globrex(filter);

    return fs.readdirSync(sourcePath, { withFileTypes: true }).filter((entry) => !!globFilter.regex.test(entry.name));
  }

  public listFiles(sourcePath: string, filter: string) {
    const globFilter = globrex(filter);

    return fs
      .readdirSync(sourcePath, { withFileTypes: true })
      .filter((entry) => !!globFilter.regex.test(entry.name))
      .map((entry) => entry.name);
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
