import { WowUpScanResult } from "../../../common/wowup/wowup-scan-result";
import { WowUpAddonRepresentation } from "../wowup-api/addon-representations";

export interface AppWowUpScanResult extends WowUpScanResult {
  exactMatch?: WowUpAddonRepresentation;
}
