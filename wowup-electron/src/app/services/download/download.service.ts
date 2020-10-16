import { Injectable } from "@angular/core";
import {
  COPY_FILE_CHANNEL,
  DOWNLOAD_FILE_CHANNEL,
  UNZIP_FILE_CHANNEL,
} from "common/constants";
import { v4 as uuidv4 } from "uuid";
import { DownloadRequest } from "common/models/download-request";
import { DownloadStatus } from "common/models/download-status";
import { DownloadStatusType } from "common/models/download-status-type";
import { UnzipRequest } from "common/models/unzip-request";
import { UnzipStatus } from "common/models/unzip-status";
import { UnzipStatusType } from "common/models/unzip-status-type";
import { ElectronService } from "../electron/electron.service";
import { CopyFileRequest } from "common/models/copy-file-request";

@Injectable({
  providedIn: "root",
})
export class DownloadSevice {
  constructor(private _electronService: ElectronService) {}

  public downloadZipFile(
    url: string,
    outputFolder: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const request: DownloadRequest = {
        url,
        outputFolder,
        responseKey: uuidv4(),
      };

      const eventHandler = (_evt: any, arg: DownloadStatus) => {
        switch (arg.type) {
          case DownloadStatusType.Complete:
            this._electronService.ipcRenderer.off(
              request.responseKey,
              eventHandler
            );
            resolve(arg.savePath);
            break;
          case DownloadStatusType.Error:
            this._electronService.ipcRenderer.off(
              request.responseKey,
              eventHandler
            );
            reject(arg.error);
            break;
          case DownloadStatusType.Progress:
            onProgress?.call(null, arg.progress);
            break;
          default:
            break;
        }
      };

      this._electronService.ipcRenderer.on(request.responseKey, eventHandler);
      this._electronService.ipcRenderer.send(DOWNLOAD_FILE_CHANNEL, request);
    });
  }

  public unzipFile(zipFilePath: string, outputFolder: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const eventHandler = (_evt: any, arg: UnzipStatus) => {
        if (arg.type === UnzipStatusType.Error) {
          return reject(arg.error);
        }
        resolve(arg.outputFolder);
      };

      const request: UnzipRequest = {
        outputFolder,
        zipFilePath,
        responseKey: uuidv4(),
      };

      this._electronService.ipcRenderer.once(request.responseKey, eventHandler);
      this._electronService.ipcRenderer.send(UNZIP_FILE_CHANNEL, request);
    });
  }

  public copyFile(
    sourceFilePath: string,
    destinationFilePath: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const eventHandler = (_evt: any, arg: { error?: Error }) => {
        if (arg.error) {
          return reject(arg.error);
        }

        resolve(destinationFilePath);
      };

      const request: CopyFileRequest = {
        destinationFilePath,
        sourceFilePath,
        responseKey: uuidv4(),
      };

      this._electronService.ipcRenderer.once(request.responseKey, eventHandler);
      this._electronService.ipcRenderer.send(COPY_FILE_CHANNEL, request);
    });
  }
}
