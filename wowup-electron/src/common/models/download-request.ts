import { IpcRequest } from "./ipc-request";

export interface DownloadAuth {
  headers?: { [key: string]: string };
  queryParams?: { [key: string]: string };
}

export interface DownloadRequest extends IpcRequest {
  url: string;
  fileName: string;
  outputFolder: string;
  auth?: DownloadAuth;
}
