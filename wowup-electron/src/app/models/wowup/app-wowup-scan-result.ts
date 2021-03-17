import { WowUpScanResult } from "../../../common/wowup/models";
import { WowUpAddonRepresentation } from "../wowup-api/addon-representations";

export interface AppWowUpScanResult extends WowUpScanResult {
  exactMatch?: WowUpAddonRepresentation;
}
