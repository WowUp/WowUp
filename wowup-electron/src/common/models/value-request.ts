import { IpcRequest } from "./ipc-request";

export interface ValueRequest<T> extends IpcRequest {
  value: T;
}
