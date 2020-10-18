import { WowUpScanResult } from "./wowup-scan-result";

export interface WowUpGetScanResultsResponse {
  error?: Error;
  scanResults: WowUpScanResult[];
}
