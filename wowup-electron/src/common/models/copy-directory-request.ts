import { IpcRequest } from "./ipc-request";

export interface CopyDirectoryRequest extends IpcRequest {
  sourcePath: string;
  destinationPath: string;
}
