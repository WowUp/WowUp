import { CurseScanResult } from "./curse-scan-result";

export interface CurseGetScanResultsResponse {
  error?: Error;
  scanResults: CurseScanResult[];
}
