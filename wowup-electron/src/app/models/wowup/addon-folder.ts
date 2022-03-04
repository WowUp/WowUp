import { FsStats } from "../../../common/models/ipc-events";
import { Addon } from "../../../common/entities/addon";
import { Toc } from "./toc";
import { CurseFolderScanResult } from "../../../common/curse/curse-folder-scan-result";
import { AppWowUpScanResult } from "./app-wowup-scan-result";

export interface AddonFolder {
  name: string;
  path: string;
  status: string;
  ignoreReason?: AddonIgnoreReason;
  thumbnailUrl?: string;
  latestVersion?: string;
  tocs: Toc[];
  matchingAddon?: Addon;
  fileStats?: FsStats;
  cfScanResults?: CurseFolderScanResult;
  wowUpScanResults?: AppWowUpScanResult;
}
