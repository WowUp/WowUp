import { v4 as uuidv4 } from "uuid";

import { Injectable } from "@angular/core";

import { IPC_DOWNLOAD_FILE_CHANNEL } from "../../../common/constants";
import { DownloadRequest } from "../../../common/models/download-request";
import { DownloadStatus } from "../../../common/models/download-status";
import { DownloadStatusType } from "../../../common/models/download-status-type";
import { ElectronService } from "../electron/electron.service";
import { DownloadAuth } from "wowup-lib-core";

export interface DownloadOptions {
  auth?: DownloadAuth;
  fileName: string;
  outputFolder: string;
  url: string;
  onProgress?: (progress: number) => void;
}

@Injectable({
  providedIn: "root",
})
export class DownloadService {
  public constructor(private _electronService: ElectronService) {}

  /**
   * Downloads a file URL to the specified folder, prepends UUID so there are no collisions
   * @returns Saved file path
   */
  public downloadZipFile(downloadOptions: DownloadOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const request: DownloadRequest = {
        auth: downloadOptions.auth,
        fileName: downloadOptions.fileName,
        outputFolder: downloadOptions.outputFolder,
        responseKey: uuidv4(),
        url: downloadOptions.url,
      };

      const eventHandler = (_evt: any, arg: DownloadStatus) => {
        if (arg.type !== DownloadStatusType.Progress) {
          this._electronService.off(request.responseKey, eventHandler);
        }

        switch (arg.type) {
          case DownloadStatusType.Complete:
            resolve(arg.savePath ?? "");
            break;
          case DownloadStatusType.Error:
            reject(arg.error);
            break;
          case DownloadStatusType.Progress:
            downloadOptions.onProgress?.call(null, arg.progress ?? 0);
            break;
          default:
            break;
        }
      };

      this._electronService.on(request.responseKey, eventHandler);
      this._electronService.send(IPC_DOWNLOAD_FILE_CHANNEL, request);
    });
  }
}
