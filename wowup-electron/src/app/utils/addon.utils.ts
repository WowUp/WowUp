import { orderBy, filter } from "lodash";
import { Addon, AddonExternalId } from "../entities/addon";

export function getAllProviders(addon: Addon): AddonExternalId[] {
  return orderBy(addon.externalIds, ["providerName"], ["asc"]);
}

export function getProviders(addon: Addon): AddonExternalId[] {
  return filter(getAllProviders(addon), (extId) => extId.providerName !== addon.providerName);
}

export function hasMultipleProviders(addon: Addon): boolean {
  return getProviders(addon).length > 0;
}

export function needsUpdate(addon: Addon): boolean {
  return addon.installedVersion !== addon.latestVersion;
}

export function needsInstall(addon: Addon): boolean {
  return !addon.installedVersion;
}
