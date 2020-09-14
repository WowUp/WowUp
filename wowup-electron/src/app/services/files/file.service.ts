import { Injectable } from "@angular/core";
import { COPY_DIRECTORY_CHANNEL, DELETE_DIRECTORY_CHANNEL, READ_FILE_CHANNEL, RENAME_DIRECTORY_CHANNEL } from "common/constants";
import { CopyDirectoryRequest } from "common/models/copy-directory-request";
import { DeleteDirectoryRequest } from "common/models/delete-directory-request";
import { ElectronService } from "../electron/electron.service";
import * as fs from 'fs';
import * as globrex from 'globrex';
import { ReadFileResponse } from "common/models/read-file-response";
import { ReadFileRequest } from "common/models/read-file-request";

@Injectable({
  providedIn: 'root'
})
export class FileService {

  constructor(
    private _electronService: ElectronService
  ) { }

  public deleteDirectory(sourcePath: string) {
    return new Promise((resolve, reject) => {
      const eventHandler = (_evt: any, arg: Error) => {
        if (arg) {
          return reject(arg);
        }
        resolve(sourcePath);
      };

      const request: DeleteDirectoryRequest = { sourcePath };

      this._electronService.ipcRenderer.on(sourcePath, eventHandler);
      this._electronService.ipcRenderer.send(DELETE_DIRECTORY_CHANNEL, request);
    })
  }

  public copyDirectory(sourcePath: string, destinationPath: string) {
    return new Promise((resolve, reject) => {
      const eventHandler = (_evt: any, arg: Error) => {
        if (arg) {
          return reject(arg);
        }

        resolve(destinationPath);
      };

      const request: CopyDirectoryRequest = { sourcePath, destinationPath };

      this._electronService.ipcRenderer.on(destinationPath, eventHandler);
      this._electronService.ipcRenderer.send(COPY_DIRECTORY_CHANNEL, request);
    })
  }

  public renameDirectory(sourcePath: string, destinationPath: string) {
    return new Promise((resolve, reject) => {
      const eventHandler = (_evt: any, arg: Error) => {
        if (arg) {
          return reject(arg);
        }

        resolve(destinationPath);
      };

      const request: CopyDirectoryRequest = { sourcePath, destinationPath };

      this._electronService.ipcRenderer.on(destinationPath, eventHandler);
      this._electronService.ipcRenderer.send(RENAME_DIRECTORY_CHANNEL, request);
    })
  }

  public readFile(sourcePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const eventHandler = (_evt: any, arg: ReadFileResponse) => {
        if (arg.error) {
          return reject(arg.error);
        }

        resolve(arg.data);
      };

      const request: ReadFileRequest = { sourcePath };

      this._electronService.ipcRenderer.on(sourcePath, eventHandler);
      this._electronService.ipcRenderer.send(READ_FILE_CHANNEL, request);
    })
  }

  public listDirectories(sourcePath: string) {
    return fs.readdirSync(sourcePath, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  }

  public listFiles(sourcePath: string, filter: string) {
    const globFilter = globrex(filter);

    return fs.readdirSync(sourcePath, { withFileTypes: true })
      .filter(entry => !!globFilter.regex.test(entry.name))
      .map(entry => entry.name);
  }
}