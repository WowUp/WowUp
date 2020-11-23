import { IpcRequest } from "./ipc-request";

export interface DeleteDirectoryRequest extends IpcRequest {
  sourcePath: string;
}
