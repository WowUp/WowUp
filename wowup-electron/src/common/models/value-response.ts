import { IpcResponse } from "./ipc-response";

export interface ValueResponse<T> extends IpcResponse {
  value: T;
}
