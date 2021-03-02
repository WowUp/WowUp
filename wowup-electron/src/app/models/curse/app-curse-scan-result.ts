import { CurseFolderScanResult } from "../../../common/curse/curse-folder-scan-result";
import { AddonFolder } from "../wowup/addon-folder";
import { CurseMatch, CurseSearchResult } from "./curse-api";

export interface AppCurseScanResult extends CurseFolderScanResult {
  exactMatch?: CurseMatch;
  searchResult?: CurseSearchResult;
  addonFolder?: AddonFolder;
}
