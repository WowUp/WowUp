import { Injectable } from "@angular/core";
import {
  COPY_FILE_CHANNEL,
  DELETE_DIRECTORY_CHANNEL,
  GET_ASSET_FILE_PATH,
  LIST_DIRECTORIES_CHANNEL,
  PATH_EXISTS_CHANNEL,
  READ_FILE_CHANNEL,
  SHOW_DIRECTORY,
  UNZIP_FILE_CHANNEL,
} from "common/constants";
import { ElectronService } from "../electron/electron.service";
import * as fs from "fs";
import * as globrex from "globrex";
import { v4 as uuidv4 } from "uuid";
import { CopyFileRequest } from "common/models/copy-file-request";
import { UnzipRequest } from "common/models/unzip-request";

@Injectable({
  providedIn: "root",
})
export class FileService {
  constructor(private _electronService: ElectronService) {}

  public async getAssetFilePath(fileName: string) {
    return await this._electronService.ipcRenderer.invoke(
      GET_ASSET_FILE_PATH,
      fileName
    );
  }

  public async showDirectory(sourceDir: string) {
    return await this._electronService.ipcRenderer.invoke(
      SHOW_DIRECTORY,
      sourceDir
    );
  }

  public async pathExists(sourcePath: string): Promise<boolean> {
    if (!sourcePath) {
      return Promise.resolve(false);
    }

    return await this._electronService.ipcRenderer.invoke(
      PATH_EXISTS_CHANNEL,
      sourcePath
    );
  }

  /**
   * Delete a file or directory
   */
  public async remove(sourcePath: string): Promise<boolean> {
    if (!sourcePath) {
      throw new Error("remove sourcePath required");
    }

    return await this._electronService.ipcRenderer.invoke(
      DELETE_DIRECTORY_CHANNEL,
      sourcePath
    );
  }

  /**
   * Copy a file or folder
   */
  public async copy(
    sourceFilePath: string,
    destinationFilePath: string
  ): Promise<string> {
    const request: CopyFileRequest = {
      destinationFilePath,
      sourceFilePath,
      responseKey: uuidv4(),
    };

    await this._electronService.ipcRenderer.invoke(COPY_FILE_CHANNEL, request);

    return destinationFilePath;
  }

  public async deleteIfExists(filePath: string) {
    if (await this.pathExists(filePath)) {
      await this.remove(filePath);
    }
  }

  public async readFile(sourcePath: string): Promise<string> {
    return await this._electronService.ipcRenderer.invoke(
      READ_FILE_CHANNEL,
      sourcePath
    );
  }

  public async listDirectories(sourcePath: string): Promise<string[]> {
    return await this._electronService.ipcRenderer.invoke(
      LIST_DIRECTORIES_CHANNEL,
      sourcePath
    );
  }

  public listEntries(sourcePath: string, filter: string) {
    const globFilter = globrex(filter);

    return fs
      .readdirSync(sourcePath, { withFileTypes: true })
      .filter((entry) => !!globFilter.regex.test(entry.name));
  }

  public listFiles(sourcePath: string, filter: string) {
    const globFilter = globrex(filter);

    return fs
      .readdirSync(sourcePath, { withFileTypes: true })
      .filter((entry) => !!globFilter.regex.test(entry.name))
      .map((entry) => entry.name);
  }

  public async unzipFile(
    zipFilePath: string,
    outputFolder: string
  ): Promise<string> {
    console.log("unzipFile", zipFilePath);

    const request: UnzipRequest = {
      outputFolder,
      zipFilePath,
      responseKey: uuidv4(),
    };

    return await this._electronService.ipcRenderer.invoke(
      UNZIP_FILE_CHANNEL,
      request
    );
  }
}
