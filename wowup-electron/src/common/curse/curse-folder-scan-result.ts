export interface CurseFolderScanResult {
  fileCount: number;
  fileDateHash?: number;
  fingerprint: number;
  folderName: string;
  individualFingerprints: number[];
  directory: string;
}
