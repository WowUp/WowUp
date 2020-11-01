import { IpcRequest } from "./ipc-request";

export interface UnzipRequest extends IpcRequest {
  zipFilePath: string;
  outputFolder: string;
}
