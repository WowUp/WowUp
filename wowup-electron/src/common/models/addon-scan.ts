import { AddonScanResult } from "wowup-lib-core";

/** Which fingerprint a scan should produce. One folder can be asked for both at once. */
export type AddonScanSource = "wowup" | "curseforge";

export interface AddonScanRequest {
  filePaths: string[];
  sources: AddonScanSource[];
}

/** Every fingerprint that was asked for, for one addon folder. */
export interface FolderScanResults {
  path: string;
  wowup?: AddonScanResult;
  curseforge?: AddonScanResult;
}
