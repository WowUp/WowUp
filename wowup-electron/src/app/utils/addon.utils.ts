import { ADDON_PROVIDER_TUKUI } from "../../common/constants";
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
  return (
    addon.installedVersion !== addon.latestVersion ||
    (addon.providerName !== ADDON_PROVIDER_TUKUI &&
      new Date(addon.updatedAt).getTime() < new Date(addon.releasedAt).getTime())
  );
}

export function needsInstall(addon: Addon): boolean {
  return !addon.installedVersion;
}

export function getGameVersion(gameVersion: string): string {
  if (!gameVersion) {
    return gameVersion;
  }

  if (gameVersion.indexOf(".") !== -1) {
    return gameVersion;
  }

  // split the long interface into 3 chunks, major minor patch
  const chunks = [
    gameVersion.substr(0, gameVersion.length - 4),
    gameVersion.substr(gameVersion.length - 4, 2),
    gameVersion.substr(gameVersion.length - 2, 2),
  ];
  return chunks.map((c) => parseInt(c, 10)).join(".");
}
