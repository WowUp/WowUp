import { IpcRequest } from "./ipc-request";

export interface ShowDirectoryRequest extends IpcRequest {
  sourceDir: string;
}
