import { CurseFolderScanResult } from "../../../common/curse/curse-folder-scan-result";
import { AddonFolder } from "../wowup/addon-folder";
import { CF2Addon, CF2FingerprintMatch } from "./curse-api-v2";

export interface AppCurseScanResult extends CurseFolderScanResult {
  exactMatch?: CF2FingerprintMatch;
  searchResult?: CF2Addon;
  addonFolder?: AddonFolder;
}
