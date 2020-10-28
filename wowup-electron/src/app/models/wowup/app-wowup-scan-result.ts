import { WowUpScanResult } from "../../../common/wowup/wowup-scan-result";
import { WowUpAddonRepresentation } from "../wowup-api/wowup-addon.representation";

export interface AppWowUpScanResult extends WowUpScanResult {
  exactMatch?: WowUpAddonRepresentation;
}
