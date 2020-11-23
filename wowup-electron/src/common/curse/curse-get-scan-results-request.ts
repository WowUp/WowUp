import { IpcRequest } from "../models/ipc-request";

export interface CurseGetScanResultsRequest extends IpcRequest {
  filePaths: string[];
}
