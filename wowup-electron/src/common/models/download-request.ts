import { DownloadAuth } from "wowup-lib-core";
import { IpcRequest } from "./ipc-request";

export interface DownloadRequest extends IpcRequest {
  url: string;
  fileName: string;
  outputFolder: string;
  auth?: DownloadAuth;
}
