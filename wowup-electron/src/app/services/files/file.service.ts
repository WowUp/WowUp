import { Injectable } from "@angular/core";
import {
  COPY_DIRECTORY_CHANNEL,
  DELETE_DIRECTORY_CHANNEL,
  GET_ASSET_FILE_PATH,
  LIST_DIRECTORIES_CHANNEL,
  LIST_FILES_CHANNEL,
  PATH_EXISTS_CHANNEL,
  READ_FILE_CHANNEL,
  RENAME_DIRECTORY_CHANNEL,
  SHOW_DIRECTORY,
} from "common/constants";
import { CopyDirectoryRequest } from "common/models/copy-directory-request";
import { DeleteDirectoryRequest } from "common/models/delete-directory-request";
import { ElectronService } from "../electron/electron.service";
import * as fs from "fs";
import * as globrex from "globrex";
import { ReadFileResponse } from "common/models/read-file-response";
import { ReadFileRequest } from "common/models/read-file-request";
import { ListFilesResponse } from "common/models/list-files-response";
import { ListFilesRequest } from "common/models/list-files-request";
import { ShowDirectoryRequest } from "common/models/show-directory-request";
import { v4 as uuidv4 } from "uuid";
import { ValueRequest } from "common/models/value-request";
import { ValueResponse } from "common/models/value-response";

@Injectable({
  providedIn: "root",
})
export class FileService {
  constructor(private _electronService: ElectronService) {}

  public async getAssetFilePath(fileName: string) {
    return await this._electronService.sendIpcValueMessage<string, string>(
      GET_ASSET_FILE_PATH,
      fileName
    );
  }

  public showDirectory(sourceDir: string) {
    return new Promise((resolve, reject) => {
      const eventHandler = (_evt: any, arg: boolean) => {
        resolve(arg);
      };

      const request: ShowDirectoryRequest = {
        sourceDir,
        responseKey: uuidv4(),
      };

      this._electronService.ipcRenderer.once(request.responseKey, eventHandler);
      this._electronService.ipcRenderer.send(SHOW_DIRECTORY, request);
    });
  }

  public pathExists(sourcePath: string) {
    return new Promise((resolve, reject) => {
      const eventHandler = (_evt: any, arg: ValueResponse<boolean>) => {
        if (arg.error) {
          return reject(arg.error);
        }
        resolve(arg.value);
      };

      const request: ValueRequest<string> = {
        value: sourcePath,
        responseKey: uuidv4(),
      };

      this._electronService.ipcRenderer.once(request.responseKey, eventHandler);
      this._electronService.ipcRenderer.send(PATH_EXISTS_CHANNEL, request);
    });
  }

  public deleteDirectory(sourcePath: string) {
    return new Promise((resolve, reject) => {
      const eventHandler = (_evt: any, arg: Error) => {
        if (arg) {
          return reject(arg);
        }
        resolve(sourcePath);
      };

      const request: DeleteDirectoryRequest = {
        sourcePath,
        responseKey: uuidv4(),
      };

      this._electronService.ipcRenderer.once(request.responseKey, eventHandler);
      this._electronService.ipcRenderer.send(DELETE_DIRECTORY_CHANNEL, request);
    });
  }

  public copyDirectory(sourcePath: string, destinationPath: string) {
    return new Promise((resolve, reject) => {
      const eventHandler = (_evt: any, arg: Error) => {
        if (arg) {
          return reject(arg);
        }

        resolve(destinationPath);
      };

      const request: CopyDirectoryRequest = {
        sourcePath,
        destinationPath,
        responseKey: uuidv4(),
      };

      this._electronService.ipcRenderer.once(request.responseKey, eventHandler);
      this._electronService.ipcRenderer.send(COPY_DIRECTORY_CHANNEL, request);
    });
  }

  public renameDirectory(sourcePath: string, destinationPath: string) {
    return new Promise((resolve, reject) => {
      const eventHandler = (_evt: any, arg: Error) => {
        if (arg) {
          return reject(arg);
        }

        resolve(destinationPath);
      };

      const request: CopyDirectoryRequest = {
        sourcePath,
        destinationPath,
        responseKey: uuidv4(),
      };

      this._electronService.ipcRenderer.once(request.responseKey, eventHandler);
      this._electronService.ipcRenderer.send(RENAME_DIRECTORY_CHANNEL, request);
    });
  }

  public readFile(sourcePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const eventHandler = (_evt: any, arg: ReadFileResponse) => {
        if (arg.error) {
          return reject(arg.error);
        }

        resolve(arg.data);
      };

      const request: ReadFileRequest = {
        sourcePath,
        responseKey: uuidv4(),
      };

      this._electronService.ipcRenderer.once(request.responseKey, eventHandler);
      this._electronService.ipcRenderer.send(READ_FILE_CHANNEL, request);
    });
  }

  public listDirectories(sourcePath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const eventHandler = (_evt: any, arg: ValueResponse<string[]>) => {
        if (arg.error) {
          return reject(arg.error);
        }

        resolve(arg.value);
      };

      const request: ValueRequest<string> = {
        value: sourcePath,
        responseKey: uuidv4(),
      };

      this._electronService.ipcRenderer.once(request.responseKey, eventHandler);
      this._electronService.ipcRenderer.send(LIST_DIRECTORIES_CHANNEL, request);
    });
  }

  public listFiles(sourcePath: string, filter: string) {
    const globFilter = globrex(filter);

    return fs
      .readdirSync(sourcePath, { withFileTypes: true })
      .filter((entry) => !!globFilter.regex.test(entry.name))
      .map((entry) => entry.name);
  }

  public listAllFiles(
    sourcePath: string,
    recursive: boolean = true
  ): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const eventHandler = (_evt: any, arg: ListFilesResponse) => {
        if (arg.error) {
          return reject(arg.error);
        }

        resolve(arg.files);
      };

      const request: ListFilesRequest = {
        sourcePath,
        recursive,
        responseKey: uuidv4(),
      };

      this._electronService.ipcRenderer.once(request.responseKey, eventHandler);
      this._electronService.ipcRenderer.send(LIST_FILES_CHANNEL, request);
    });
  }
}
