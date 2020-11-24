import { IpcRequest } from "./ipc-request";

export interface CopyFileRequest extends IpcRequest {
  sourceFilePath: string;
  destinationFilePath: string;
}
