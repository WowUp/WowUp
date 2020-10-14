import { WowUpAddonRepresentation } from "../wowup-api/wowup-addon.representation";
import { WowUpScanResult } from "../../../common/wowup/wowup-scan-result";

export interface AppWowUpScanResult extends WowUpScanResult{
  exactMatch?: WowUpAddonRepresentation;
}
