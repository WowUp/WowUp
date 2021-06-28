import { orderBy, filter } from "lodash";
import { Addon, AddonExternalId } from "../../common/entities/addon";
import { AddonDependency, AddonDependencyType } from "../../common/wowup/models";

export function getAllProviders(addon: Addon): AddonExternalId[] {
  return orderBy(addon.externalIds, ["providerName"], ["asc"]);
}

export function getProviders(addon: Addon): AddonExternalId[] {
  return filter(getAllProviders(addon), (extId) => extId.providerName !== addon.providerName);
}

export function hasMultipleProviders(addon: Addon): boolean {
  return getProviders(addon).length > 0;
}

export function getAddonDependencies(
  addon: Addon,
  dependencyType: AddonDependencyType | undefined = undefined
): AddonDependency[] {
  if (dependencyType === undefined) {
    return addon.dependencies ?? [];
  }

  return filter(addon.dependencies, (dep) => dep.type === dependencyType);
}

export function needsUpdate(addon: Addon | undefined): boolean {
  if (addon.isIgnored) {
    return false;
  }

  // Sometimes authors push out new builds without changing the toc version.
  if (addon.externalLatestReleaseId && addon.externalLatestReleaseId !== addon.installedExternalReleaseId) {
    return true;
  }

  return !!addon.installedVersion && addon.installedVersion !== addon.latestVersion;
}

export function needsInstall(addon: Addon): boolean {
  return !addon.installedVersion;
}

export function getGameVersion(gameVersion: string | undefined): string {
  if (!gameVersion) {
    return "";
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

export function toInterfaceVersion(version: string): string {
  if (!version) {
    throw new Error("interface version empty or undefined");
  }

  if (version.indexOf(".") === -1) {
    return version;
  }

  const parts = version.split(".");
  if (parts.length != 3) {
    throw new Error(`Cannot convert ${version} to interface format`);
  }

  const paddedParts = parts.map((part, idx) => padInterfacePart(part, idx));

  return paddedParts.join("");
}

function padInterfacePart(part: string, idx: number) {
  const num = parseInt(part, 10);
  if (idx === 0) {
    return num;
  }
  return num >= 10 ? num : `0${num}`;
}
