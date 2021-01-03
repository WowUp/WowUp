import { orderBy, filter, map } from "lodash";
import { Addon, AddonExternalId } from "../entities/addon";
import { AddonDependencyType } from "../models/wowup/addon-dependency-type";

export function getAllProviders(addon: Addon): AddonExternalId[] {
  return orderBy(addon.externalIds, ["providerName"], ["asc"]);
}

export function getProviders(addon: Addon): AddonExternalId[] {
  return filter(getAllProviders(addon), (extId) => extId.providerName !== addon.providerName);
}

export function hasMultipleProviders(addon: Addon): boolean {
  return getProviders(addon).length > 0;
}

export function getAddonDependencies(addon: Addon, dependencyType: AddonDependencyType = undefined) {
  return dependencyType == undefined
    ? addon.dependencies
    : filter(addon.dependencies, (dep) => dep.type === dependencyType);
}

export function needsUpdate(addon: Addon): boolean {
  return (
    (addon.externalLatestReleaseId && addon.externalLatestReleaseId !== addon.installedExternalReleaseId) ||
    addon.installedVersion !== addon.latestVersion
  );
}

export function needsInstall(addon: Addon): boolean {
  return !addon.installedVersion;
}

export function getFolderList(addon: Addon): string[] {
  return map(addon.installedFolders?.split(","), (folder) => folder.trim());
}

export function getGameVersion(gameVersion: string): string {
  if (!gameVersion) {
    return gameVersion;
  }

  if (gameVersion.toString().indexOf(".") !== -1) {
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
