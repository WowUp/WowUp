import {
  Addon,
  AddonChannelType,
  AddonSearchResult,
  AddonSearchResultDependency,
  AddonWarningType,
  getEnumName,
  getGameVersionList,
} from "wowup-lib-core";

import { getFileTargetVersions } from "../../../src/common/addons/game-versions";
import { getLatestFile } from "../../../src/common/addons/search-results";
import { AppliedAddonSync, ApplyAddonSyncRequest } from "../../../src/common/models/addon-scan";

export interface SyncLog {
  warn: (...args: unknown[]) => void;
}

export interface SyncOutcome extends AppliedAddonSync {
  /** The addons that changed and need saving */
  changed: Addon[];
}

function addonMatchesSearchResult(addon: Addon, result: AddonSearchResult): boolean {
  return addon?.externalId?.toString() === result?.externalId?.toString() && addon.providerName === result.providerName;
}

const createAddonDependency = (dependency: AddonSearchResultDependency) => ({
  externalAddonId: dependency.externalAddonId,
  type: dependency.type,
});

/**
 * Apply one provider's sync answer to the addons it was asked about: flag the ones it reported a
 * warning for, then bring each one it returned up to date with its latest file. Mutates the addons.
 */
export function applyAddonSync(request: ApplyAddonSyncRequest, log: SyncLog): SyncOutcome {
  const { addons, providerName, searchResults, failures } = request;
  const changed = new Set<Addon>();

  const failureAddonNames = failures.map((failure) => {
    const addon = failure.addonId
      ? addons.find((a) => a.externalId === failure.addonId && a.providerName === providerName)
      : undefined;

    if (failure.warningType !== undefined && addon !== undefined) {
      addon.warningType = failure.warningType;
      if (addon.id) {
        changed.add(addon);
      }
    }

    return addon?.name;
  });

  const noFileAddons: AppliedAddonSync["noFileAddons"] = [];

  for (const result of searchResults) {
    const addon = addons.find((a) => addonMatchesSearchResult(a, result));
    if (!addon) {
      continue;
    }

    changed.add(addon);

    const latestFile = getLatestFile(result, addon.channelType);
    if (!latestFile) {
      log.warn(`No latest file found: ${addon.name}, clientType: ${addon.clientType}`);
      addon.warningType = AddonWarningType.NoProviderFiles;
      noFileAddons.push({ name: addon.name, providerName: addon.providerName ?? "" });
      continue;
    }

    // Legacy TukUI/ElvUI ids were ints, correct them
    if (addon.externalId !== undefined && typeof addon.externalId !== "string") {
      addon.externalId = (addon.externalId as unknown as number).toString();
    }

    addon.summary = result.summary;
    addon.thumbnailUrl = result.thumbnailUrl;
    addon.latestChangelog = latestFile.changelog || addon.latestChangelog;

    if (
      addon.warningType &&
      [AddonWarningType.MissingOnProvider, AddonWarningType.NoProviderFiles].includes(addon.warningType)
    ) {
      addon.warningType = undefined;
    }

    addon.screenshotUrls = result.screenshotUrls;

    // Check for a new download URL
    if (latestFile.downloadUrl && latestFile.downloadUrl !== addon.downloadUrl) {
      addon.downloadUrl = latestFile.downloadUrl;
    }

    // Kept in step with the download URL, so an install or update pulls in what the file it downloads requires.
    // Refreshed even when the release has not changed, to heal records saved from an older file.
    if (Array.isArray(latestFile.dependencies)) {
      addon.dependencies = latestFile.dependencies.map(createAddonDependency);
    }

    if (Array.isArray(result.fundingLinks)) {
      addon.fundingLinks = result.fundingLinks;
    }

    // Describes the release on offer, so an update found before the game version was tracked gets one too
    const latestTargetVersions = getFileTargetVersions(latestFile);
    if (latestTargetVersions.length > 0) {
      addon.gameVersion = getGameVersionList(latestTargetVersions);
    }

    // If the release ID hasn't changed we don't really need to update the whole record
    if (!!latestFile.externalId && latestFile.externalId === addon.externalLatestReleaseId) {
      continue;
    }

    // There was nothing new to update to
    if (latestFile.version === addon.latestVersion && latestFile.releaseDate === addon.releasedAt) {
      continue;
    }

    addon.latestVersion = latestFile.version;
    addon.releasedAt = latestFile.releaseDate;
    addon.externalLatestReleaseId = latestFile.externalId;
    addon.name = result.name;
    addon.author = result.author;
    addon.externalChannel = getEnumName(AddonChannelType, latestFile.channelType);

    if (latestTargetVersions.length === 0) {
      if (addon.gameVersion) {
        addon.gameVersion = getGameVersionList(addon.gameVersion ?? []);
      } else {
        log.warn("No game version found", addon.name);
      }
    }

    addon.externalUrl = result.externalUrl;
  }

  return { addons, changed: [...changed], failureAddonNames, noFileAddons };
}
