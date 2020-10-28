import { CurseScanResult } from "../../../common/curse/curse-scan-result";
import { AddonFolder } from "../wowup/addon-folder";

export interface AppCurseScanResult extends CurseScanResult {
  addonFolder?: AddonFolder;
}
