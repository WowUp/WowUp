import { UnzipStatusType } from "./unzip-status-type";

export interface UnzipStatus {
    type: UnzipStatusType;
    outputFolder: string;
    error?: Error;
}