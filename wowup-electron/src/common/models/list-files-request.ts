import { IpcRequest } from "./ipc-request";

export interface ListFilesRequest extends IpcRequest {
  sourcePath: string;
  recursive: boolean;
}
