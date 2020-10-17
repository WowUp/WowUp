import { IpcRequest } from "./ipc-request";

export interface DownloadRequest extends IpcRequest {
  url: string;
  outputFolder: string;
}
