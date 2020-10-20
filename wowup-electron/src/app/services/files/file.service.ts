import { Injectable } from "@angular/core";
import {
  COPY_DIRECTORY_CHANNEL,
  COPY_FILE_CHANNEL,
  DELETE_DIRECTORY_CHANNEL,
  DELETE_FILE_CHANNEL,
  GET_ASSET_FILE_PATH,
  LIST_DIRECTORIES_CHANNEL,
  LIST_FILES_CHANNEL,
  PATH_EXISTS_CHANNEL,
  READ_FILE_CHANNEL,
  RENAME_DIRECTORY_CHANNEL,
  SHOW_DIRECTORY,
  UNZIP_FILE_CHANNEL,
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
import { CopyFileRequest } from "common/models/copy-file-request";
import { UnzipRequest } from "common/models/unzip-request";
import { UnzipStatus } from "common/models/unzip-status";
import { IpcResponse } from "common/models/ipc-response";

@Injectable({
  providedIn: "root",
})
export class FileService {
  constructor(private _electronService: ElectronService) { }

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

  public pathExists(sourcePath: string): Promise<boolean> {
    if (!sourcePath) {
      return Promise.resolve(false);
    }

    return new Promise((resolve, reject) => {
      const eventHandler = (_evt: any, arg: ValueResponse<boolean>) => {
        console.log("pathExists", arg);
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

  public async deleteDirectory(sourcePath: string) {
    const request: DeleteDirectoryRequest = {
      sourcePath,
      responseKey: uuidv4(),
    };

    const response = await this._electronService.sendIPCMessage<
      DeleteDirectoryRequest,
      IpcResponse
    >(DELETE_DIRECTORY_CHANNEL, request);

    return sourcePath;
  }

  public async deleteFile(sourcePath: string): Promise<boolean> {
    return await this._electronService.sendIpcValueMessage<string, boolean>(
      DELETE_FILE_CHANNEL,
      sourcePath
    );
  }

  public async copyFile(
    sourceFilePath: string,
    destinationFilePath: string
  ): Promise<string> {
    const request: CopyFileRequest = {
      destinationFilePath,
      sourceFilePath,
      responseKey: uuidv4(),
    };

    const response = await this._electronService.sendIPCMessage<
      CopyFileRequest,
      IpcResponse
    >(COPY_FILE_CHANNEL, request);

    return destinationFilePath;
  }

  public async copyDirectory(sourcePath: string, destinationPath: string) {
    const request: CopyDirectoryRequest = {
      sourcePath,
      destinationPath,
      responseKey: uuidv4(),
    };

    const result = await this._electronService.ipcRenderer.invoke(COPY_DIRECTORY_CHANNEL, request);
    console.log('RES', result);
    return destinationPath;

    // const response = await this._electronService.sendIPCMessage<
    //   CopyDirectoryRequest,
    //   IpcResponse
    // >(COPY_DIRECTORY_CHANNEL, request);

    // return destinationPath;
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

  public async deleteIfExists(filePath: string) {
    if (await this.pathExists(filePath)) {
      await this.deleteDirectory(filePath);
    }
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

  public async listAllFiles(
    sourcePath: string,
    recursive: boolean = true
  ): Promise<string[]> {
    const request: ListFilesRequest = {
      sourcePath,
      recursive,
      responseKey: uuidv4(),
    };

    const response = await this._electronService.sendIPCMessage<
      ListFilesRequest,
      ListFilesResponse
    >(UNZIP_FILE_CHANNEL, request);

    return response.files;
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

    const response = await this._electronService.sendIPCMessage<
      UnzipRequest,
      UnzipStatus
    >(UNZIP_FILE_CHANNEL, request);

    return response.outputFolder;
  }
}
