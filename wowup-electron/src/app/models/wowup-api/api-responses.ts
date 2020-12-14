import { WowUpAddonRepresentation } from "./addon-representations";

export interface WowUpGetAddonResponse {
  addon: WowUpAddonRepresentation;
}

export interface WowUpGetAddonsResponse {
  addons: WowUpAddonRepresentation[];
  count: number;
}

export interface WowUpSearchAddonsResponse {
  addons: WowUpAddonRepresentation[];
  count: number;
}