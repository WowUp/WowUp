import { AddonFolder } from "../wowup/addon-folder";
import { CurseScanResult } from "../../../common/curse/curse-scan-result";

export interface AppCurseScanResult extends CurseScanResult {
  addonFolder?: AddonFolder;
}
