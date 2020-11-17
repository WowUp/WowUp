import { orderBy, filter } from "lodash";
import { Addon } from "../entities/addon";

export function getAllProviders(addon: Addon) {
  return orderBy(addon.externalIds, ["providerName"], ["asc"]);
}

export function getProviders(addon: Addon) {
  return filter(getAllProviders(addon), (extId) => extId.providerName !== addon.providerName);
}

export function hasMultipleProviders(addon: Addon) {
  return getProviders(addon).length > 0;
}
