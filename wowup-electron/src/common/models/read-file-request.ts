import { IpcRequest } from "./ipc-request";

export interface ReadFileRequest extends IpcRequest {
  sourcePath: string;
}
