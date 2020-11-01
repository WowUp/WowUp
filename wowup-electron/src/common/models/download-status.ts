import { DownloadStatusType } from "./download-status-type";

export interface DownloadStatus {
  type: DownloadStatusType;
  progress?: number;
  savePath?: string;
  error?: Error;
}
