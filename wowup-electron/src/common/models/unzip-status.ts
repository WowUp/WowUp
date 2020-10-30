import { IpcResponse } from "./ipc-response";
export interface UnzipStatus extends IpcResponse {
  outputFolder: string;
}
