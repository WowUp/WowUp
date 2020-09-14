import { Injectable } from "@angular/core";
import { COPY_FILE_CHANNEL, DOWNLOAD_FILE_CHANNEL, UNZIP_FILE_CHANNEL } from "common/constants";
import { DownloadRequest } from "common/models/download-request";
import { DownloadStatus } from "common/models/download-status";
import { DownloadStatusType } from "common/models/download-status-type";
import { UnzipRequest } from "common/models/unzip-request";
import { UnzipStatus } from "common/models/unzip-status";
import { UnzipStatusType } from "common/models/unzip-status-type";
import { ElectronService } from "../electron/electron.service";
import { CopyFileRequest } from "common/models/copy-file-request";

@Injectable({
    providedIn: 'root'
})
export class DownloadSevice {

    constructor(
        private _electronService: ElectronService
    ) { }

    public downloadZipFile(url: string, outputFolder: string, onProgress?: (progress: number) => void): Promise<string> {
        return new Promise((resolve, reject) => {
            const eventHandler = (_evt: any, arg: DownloadStatus) => {
                switch (arg.type) {
                    case DownloadStatusType.Complete:
                        resolve(arg.savePath);
                        this._electronService.ipcRenderer.off(url, eventHandler);
                        break;
                    case DownloadStatusType.Error:
                        reject(arg.error);
                        this._electronService.ipcRenderer.off(url, eventHandler);
                        break;
                    case DownloadStatusType.Progress:
                        onProgress?.call(null, arg.progress);
                        break;
                    default:
                        break;
                }
            };

            this._electronService.ipcRenderer.on(url, eventHandler);
            this._electronService.ipcRenderer.send(DOWNLOAD_FILE_CHANNEL, { url, outputFolder } as DownloadRequest);
        })
    }

    public unzipFile(zipFilePath: string, outputFolder: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const eventHandler = (_evt: any, arg: UnzipStatus) => {
                this._electronService.ipcRenderer.off(zipFilePath, eventHandler);

                if (arg.type === UnzipStatusType.Error) {
                    return reject(arg.error);
                }
                resolve(arg.outputFolder);
            }

            const request: UnzipRequest = {
                outputFolder,
                zipFilePath
            };

            this._electronService.ipcRenderer.on(zipFilePath, eventHandler);
            this._electronService.ipcRenderer.send(UNZIP_FILE_CHANNEL, request);
        });
    }

    public copyFile(sourceFilePath: string, destinationFilePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const eventHandler = (_evt: any, arg: { error?: Error }) => {
                this._electronService.ipcRenderer.off(destinationFilePath, eventHandler);
                if (arg.error) {
                    return reject(arg.error);
                }

                resolve(destinationFilePath);
            };

            const request: CopyFileRequest = {
                destinationFilePath,
                sourceFilePath
            };

            this._electronService.ipcRenderer.on(destinationFilePath, eventHandler);
            this._electronService.ipcRenderer.send(COPY_FILE_CHANNEL, request);
        })
    }
}