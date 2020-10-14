import { IpcRequest } from "../models/ipc-request";

export interface WowUpGetScanResultsRequest extends IpcRequest {
  filePaths: string[];
}
