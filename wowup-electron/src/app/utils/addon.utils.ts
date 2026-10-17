import { orderBy, filter } from "lodash";
import { Addon, AddonDependency, AddonDependencyType, AddonExternalId } from "wowup-lib-core";

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

/**
 * Accepts n semver (10.0.0) and formats it as an interface version (100000)
 * if the format is invalid or missing throw error
 */
export function toInterfaceVersion(version: string): string {
  if (!version) {
    throw new Error("interface version empty or undefined");
  }

  if (version.indexOf(".") === -1) {
    return version;
  }

  const parts = version.split(".");
  if (parts.length != 3) {
    console.warn(`invalid part length: ${parts.length} - ${version}`);
    while (parts.length < 3) {
      parts.push("0");
    }
    console.warn(`guessing version: ${parts.join(".")}`);
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
