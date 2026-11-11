import { orderBy, filter } from "lodash";
import {
  Addon,
  AddonDependency,
  AddonDependencyType,
  AddonExternalId,
  getGameVersion,
  WowClientType,
  WowInstallation,
} from "wowup-lib-core";

import { toInterfaceNumber } from "../../common/addons/game-versions";

// Moved to src/common so the main process can use them, re-exported so call sites keep their imports
export { getFileTargetVersions, toInterfaceVersion } from "../../common/addons/game-versions";

/** Whether an external id's provider can be switched to in this build, see AddonProviderFactory.isProviderAvailable */
export type ProviderAvailability = (providerName: string) => boolean;

/**
 * Every provider the addon can be switched to, plus its own. Ids for providers this build does not
 * ship or the user turned off (e.g. CurseForge ids from tocs on the wago build) are left out, picking
 * one could only fail.
 */
export function getAllProviders(addon: Addon, isAvailable: ProviderAvailability = () => true): AddonExternalId[] {
  const available = filter(
    addon.externalIds,
    (extId) => extId.providerName === addon.providerName || isAvailable(extId.providerName),
  );
  return orderBy(available, ["providerName"], ["asc"]);
}

export function getProviders(addon: Addon, isAvailable?: ProviderAvailability): AddonExternalId[] {
  return filter(getAllProviders(addon, isAvailable), (extId) => extId.providerName !== addon.providerName);
}

export function hasMultipleProviders(addon: Addon, isAvailable?: ProviderAvailability): boolean {
  return getProviders(addon, isAvailable).length > 0;
}

export function getAddonDependencies(
  addon: Addon,
  dependencyType: AddonDependencyType | undefined = undefined,
): AddonDependency[] {
  if (dependencyType === undefined) {
    return addon.dependencies ?? [];
  }

  return filter(addon.dependencies, (dep) => dep.type === dependencyType);
}

export function needsUpdate(addon: Addon | undefined): boolean {
  if (addon === undefined || addon.isIgnored) {
    return false;
  }

  // Sometimes authors push out new builds without changing the toc version.
  if (addon.externalLatestReleaseId && addon.externalLatestReleaseId !== addon.installedExternalReleaseId) {
    return true;
  }

  const installedVer = (addon?.installedVersion ?? "").replace(/^v/i, "");
  const latestVer = (addon?.latestVersion ?? "").replace(/^v/i, "");

  return installedVer.length > 0 && installedVer !== latestVer;
}

export function needsInstall(addon: Addon): boolean {
  return !addon.installedVersion;
}

// export function getGameVersion(interfaceStr: string | undefined): string {
//   if (typeof interfaceStr !== "string" || interfaceStr.length === 0) {
//     return Array(3).fill("0").join(".");
//   }

//   if (interfaceStr.toString().indexOf(".") !== -1) {
//     return interfaceStr;
//   }

//   // split the long interface into 3 chunks, major minor patch
//   const chunks = [
//     interfaceStr.substring(0, interfaceStr.length - 4),
//     interfaceStr.substring(interfaceStr.length - 4, interfaceStr.length - 2),
//     interfaceStr.substring(interfaceStr.length - 2),
//   ];
//   return chunks.map((c) => parseInt(c, 10)).join(".");
// }

/** Clients whose version tracks a live release; PTR and beta builds are expected to run ahead of addons. */
const VERSION_CHECKED_CLIENT_TYPES: WowClientType[] = [
  WowClientType.Retail,
  WowClientType.Classic,
  WowClientType.ClassicEra,
  WowClientType.Anniversary,
  WowClientType.Forever,
];

/**
 * Versions of different game flavors are not comparable (retail 12.1.5 vs classic era 1.15.9), and a
 * release lists the patches of every flavor it supports. Forever (1.60+) shares major version 1 with era.
 */
function getVersionFlavor(interfaceNumber: number): string {
  const major = Math.floor(interfaceNumber / 10000);
  const minor = Math.floor(interfaceNumber / 100) % 100;

  if (major >= 6) {
    return "retail";
  }

  if (major === 1) {
    return minor >= 60 ? "forever" : "era";
  }

  return `classic-${major}`;
}

/**
 * Whether a release targeting `targetVersions` (patches such as "12.1.5" or interface numbers) can run on a
 * client at `installedGameVersion`. A release is only too new when every target of the client's own flavor is
 * newer than the client. Fails open: missing or unreadable versions are treated as compatible.
 */
export function isAddonVersionCompatible(
  targetVersions: string[] | string | undefined,
  installedGameVersion: string | undefined,
): boolean {
  const installed = toInterfaceNumber(installedGameVersion);
  if (installed === undefined) {
    return true;
  }

  const installedFlavor = getVersionFlavor(installed);
  const targets = (Array.isArray(targetVersions) ? targetVersions : [targetVersions])
    .map(toInterfaceNumber)
    .filter((target): target is number => target !== undefined && getVersionFlavor(target) === installedFlavor);

  return targets.length === 0 || targets.some((target) => target <= installed);
}

/** The oldest game version of the client's own flavor a release targets, as "12.1.7", for telling the user what it needs. */
export function getRequiredGameVersion(
  targetVersions: string[] | string | undefined,
  installedGameVersion: string | undefined,
): string | undefined {
  const installed = toInterfaceNumber(installedGameVersion);
  if (installed === undefined) {
    return undefined;
  }

  const required = (Array.isArray(targetVersions) ? targetVersions : [targetVersions])
    .map((version) => ({ version, interfaceNumber: toInterfaceNumber(version) }))
    .filter(
      (target) =>
        target.interfaceNumber !== undefined &&
        getVersionFlavor(target.interfaceNumber) === getVersionFlavor(installed),
    )
    .sort((a, b) => (a.interfaceNumber ?? 0) - (b.interfaceNumber ?? 0))[0];

  return required?.version ? getGameVersion(required.version) : undefined;
}

/** The newest of the versions that belong to the installed game version's flavor, undefined when none do or the client is unknown. */
export function getNewestVersionOfInstalledFlavor(
  versions: string[],
  installedGameVersion: string | undefined,
): string | undefined {
  const installed = toInterfaceNumber(installedGameVersion);
  if (installed === undefined) {
    return undefined;
  }

  return versions
    .map((version) => ({ version, interfaceNumber: toInterfaceNumber(version) }))
    .filter(
      (entry) =>
        entry.interfaceNumber !== undefined && getVersionFlavor(entry.interfaceNumber) === getVersionFlavor(installed),
    )
    .sort((a, b) => (b.interfaceNumber ?? 0) - (a.interfaceNumber ?? 0))[0]?.version;
}

/** Whether the installation's game version is worth checking addons against, see VERSION_CHECKED_CLIENT_TYPES */
export function isVersionCheckedInstallation(installation: WowInstallation | undefined): boolean {
  return !!installation && !!installation.gameVersion && VERSION_CHECKED_CLIENT_TYPES.includes(installation.clientType);
}

/** Whether the user chose to ignore version mismatches for the game version the installation is on right now */
export function isCompatibilityIgnored(installation: WowInstallation | undefined): boolean {
  return !!installation?.gameVersion && installation.ignoredCompatibilityVersion === installation.gameVersion;
}

/**
 * Whether an addon release targeting `targetVersions` should be offered to the installation without a warning.
 * False only when the installation runs an older game version than the release needs and the user has not
 * chosen to ignore that for the current game version.
 */
export function isAddonCompatibleWithInstallation(
  targetVersions: string[] | string | undefined,
  installation: WowInstallation | undefined,
): boolean {
  if (!isVersionCheckedInstallation(installation) || isCompatibilityIgnored(installation)) {
    return true;
  }

  return isAddonVersionCompatible(targetVersions, installation?.gameVersion);
}
