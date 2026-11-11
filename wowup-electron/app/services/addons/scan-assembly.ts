import * as _ from "lodash";
import {
  Addon,
  AddonChannelType,
  AddonFolder,
  AddonWarningType,
  getEnumName,
  getGameVersionList,
  Toc,
  WowInstallation,
} from "wowup-lib-core";

import { getTocForGameType2, setExternalIds } from "../../../src/common/addons/addon-rules";
import { ADDON_PROVIDER_UNKNOWN } from "../../../src/common/constants";

export interface ScanAssemblyLog {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

export interface ScanAssemblyDeps {
  /** When the folder's newest file was last changed, ms since the epoch */
  getLatestDirUpdateTime: (dirPath: string) => Promise<number>;
  newId: () => string;
  log: ScanAssemblyLog;
}

/**
 * Take the folders of the addons that a scan can't find again (their provider is in `nonRescanProviders`,
 * e.g. GitHub) out of `addonFolders`, and return those addons so they can be kept as they are.
 * An addon whose provider is unknown isn't kept, the scan decides what it is.
 */
export function removeNonRescanFolders(
  addonFolders: AddonFolder[],
  currentAddons: Addon[],
  nonRescanProviders: ReadonlySet<string>,
  log: ScanAssemblyLog,
): Addon[] {
  const remainingAddons: Addon[] = [];
  const removedAddonFolders: AddonFolder[] = [];

  for (const currentAddon of currentAddons) {
    if (!nonRescanProviders.has(currentAddon.providerName ?? "")) {
      continue;
    }

    const removed = _.remove(addonFolders, (af) => (currentAddon.installedFolderList ?? []).includes(af.name));
    removedAddonFolders.push(...removed);

    remainingAddons.push(currentAddon);
  }

  log.info(
    `Removed ${removedAddonFolders.length} NonRescan folders: ${removedAddonFolders.map((af) => af.name).join(", ")}`,
  );
  log.info(`Kept ${remainingAddons.length} NonRescan addons: ${remainingAddons.map((ad) => ad.name).join(", ")}`);

  return remainingAddons;
}

/**
 * A link the user made (isManuallyLinked) must survive a rescan as long as the addon is still there:
 * match the folders of those addons to them up front, so no provider is asked about them and the scan
 * hands the saved addon back. Addons of `nonRescanProviders` are kept by removeNonRescanFolders already.
 */
export function keepLinkedAddons(
  addonFolders: AddonFolder[],
  currentAddons: Addon[],
  nonRescanProviders: ReadonlySet<string>,
): void {
  for (const currentAddon of currentAddons) {
    if (currentAddon.isManuallyLinked !== true || nonRescanProviders.has(currentAddon.providerName ?? "")) {
      continue;
    }

    for (const addonFolder of addonFolders) {
      if (!addonFolder.matchingAddon && (currentAddon.installedFolderList ?? []).includes(addonFolder.name)) {
        addonFolder.matchingAddon = currentAddon;
      }
    }
  }
}

/**
 * Turn folders the providers have matched into the installation's addon list: one addon per matched
 * addon (its folders grouped), one ignored "unknown" addon per folder nothing matched, plus `keptAddons`.
 */
export async function assembleScannedAddons(
  addonFolders: AddonFolder[],
  keptAddons: Addon[],
  installation: WowInstallation,
  providerNames: ReadonlySet<string>,
  deps: ScanAssemblyDeps,
): Promise<Addon[]> {
  const addonList: Addon[] = [...keptAddons];

  const matchedAddonFolders = addonFolders.filter((addonFolder) => !!addonFolder.matchingAddon);
  const matchedAddonFolderNames = matchedAddonFolders.map((mf) => mf.name);

  for (const maf of matchedAddonFolders) {
    if (maf.matchingAddon === undefined) {
      continue;
    }

    const targetToc = getTocForGameType2(maf.name, maf.tocs, installation.clientType);
    if (targetToc === undefined) {
      deps.log.warn("toc file undefined", maf.name, installation.clientType);
      continue;
    }

    if (!targetToc.fileName.startsWith(maf.name)) {
      deps.log.warn("TOC NAME MISMATCH", maf.name, targetToc.fileName);
      maf.matchingAddon.warningType = AddonWarningType.TocNameMismatch;
    }

    setExternalIds(maf.matchingAddon, targetToc, providerNames);
  }

  const matchedGroups = _.groupBy(
    matchedAddonFolders,
    (addonFolder) => `${addonFolder.matchingAddon?.providerName ?? ""}${addonFolder.matchingAddon?.externalId ?? ""}`,
  );

  deps.log.debug(`matchedGroups: ${Object.keys(matchedGroups).length} groups`);

  for (const value of Object.values(matchedGroups)) {
    const ordered = _.orderBy(value, (v) => v.matchingAddon?.externalIds?.length ?? 0).reverse();
    const first = ordered[0];
    if (first.matchingAddon) {
      addonList.push(first.matchingAddon);
    }
  }

  const unmatchedFolders = addonFolders.filter((af) =>
    isAddonFolderUnmatched(matchedAddonFolderNames, af, installation),
  );

  for (const uf of unmatchedFolders) {
    addonList.push(await createUnmatchedAddon(uf, installation, matchedAddonFolderNames, deps));
  }

  //Clear the changelogs since they wont always be latest
  for (const addon of addonList) {
    if (!addon) {
      continue;
    }

    addon.latestChangelog = undefined;
    addon.latestChangelogVersion = undefined;
    addon.channelType = installation.defaultAddonChannelType;
  }

  deps.log.debug(`scan complete: ${addonList.length} addons`);

  return addonList;
}

/** Carry the user's settings from the addons saved before a rescan over to the ones it found */
export function mergeAddonSettings(existingAddons: Addon[], newAddons: Addon[]): Addon[] {
  for (const newAddon of newAddons) {
    const existingAddon = existingAddons.find(
      (ea) => ea.externalId?.toString() === newAddon.externalId?.toString() && ea.providerName == newAddon.providerName,
    );

    if (!existingAddon) {
      continue;
    }

    newAddon.autoUpdateEnabled = existingAddon.autoUpdateEnabled;
    newAddon.isIgnored = existingAddon.isIgnored;
    newAddon.installedAt = existingAddon.installedAt;
    newAddon.channelType = Math.max(existingAddon.channelType, newAddon.channelType);
  }

  return newAddons;
}

/**
 * This should verify that a folder that did not have a match, is actually unmatched
 * This will happen for any sub folders of TukUI or WowInterface addons
 */
function isAddonFolderUnmatched(matchedFolderNames: string[], addonFolder: AddonFolder, installation: WowInstallation) {
  if (addonFolder.matchingAddon) {
    return false;
  }

  const targetToc = getTocForGameType2(addonFolder.name, addonFolder.tocs, installation.clientType);

  // if the folder is load on demand, it 'should' be a sub folder
  const isLoadOnDemand = targetToc?.loadOnDemand === "1";
  if (isLoadOnDemand && _.difference(targetToc.dependencyList, matchedFolderNames).length === 0) {
    return false;
  }

  return true;
}

function hasValidTocTitle(toc: Toc | undefined): boolean {
  return !!toc?.title && /[a-zA-Z]/g.test(toc.title);
}

async function createUnmatchedAddon(
  addonFolder: AddonFolder,
  installation: WowInstallation,
  matchedAddonFolderNames: string[],
  deps: ScanAssemblyDeps,
): Promise<Addon> {
  const targetToc = getTocForGameType2(addonFolder.name, addonFolder.tocs, installation.clientType);
  const tocMissingDependencies = _.difference(targetToc?.dependencyList, matchedAddonFolderNames);
  const lastUpdatedAt = await deps.getLatestDirUpdateTime(addonFolder.path);

  return {
    id: deps.newId(),
    name: hasValidTocTitle(targetToc) ? targetToc?.title ?? addonFolder.name : addonFolder.name,
    thumbnailUrl: "",
    latestVersion: targetToc?.version || "",
    installedVersion: targetToc?.version || "",
    clientType: installation.clientType,
    externalId: "",
    gameVersion: getGameVersionList(targetToc?.interface ?? []),
    author: targetToc?.author || "",
    downloadUrl: "",
    externalUrl: "",
    providerName: ADDON_PROVIDER_UNKNOWN,
    channelType: AddonChannelType.Stable,
    isIgnored: true,
    autoUpdateEnabled: false,
    autoUpdateNotificationsEnabled: false,
    releasedAt: new Date(lastUpdatedAt),
    installedAt: addonFolder.fileStats?.mtime || new Date(),
    installedFolders: addonFolder.name,
    installedFolderList: [addonFolder.name],
    summary: "",
    screenshotUrls: [],
    isLoadOnDemand: targetToc?.loadOnDemand === "1",
    externalChannel: getEnumName(AddonChannelType, AddonChannelType.Stable),
    missingDependencies: tocMissingDependencies,
    ignoreReason: addonFolder.ignoreReason,
    installationId: installation.id,
  };
}
