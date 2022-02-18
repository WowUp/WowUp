import { CF2Addon, CF2FingerprintMatch } from "curseforge-v2";
import { CurseFolderScanResult } from "../../../common/curse/curse-folder-scan-result";
import { AddonFolder } from "../wowup/addon-folder";
import { CurseMatch, CurseSearchResult } from "./curse-api";

export interface AppCurseScanResult extends CurseFolderScanResult {
  exactMatch?: CurseMatch;
  searchResult?: CurseSearchResult;
  addonFolder?: AddonFolder;
}

export interface AppCurseV2ScanResult extends CurseFolderScanResult {
  exactMatch?: CF2FingerprintMatch;
  searchResult?: CF2Addon;
  addonFolder?: AddonFolder;
}
