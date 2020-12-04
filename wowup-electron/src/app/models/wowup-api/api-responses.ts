import { WowUpAddonRepresentation } from "./addon-representations";

export interface WowUpGetAddonsResponse {
  addons: WowUpAddonRepresentation[];
  count: number;
}
