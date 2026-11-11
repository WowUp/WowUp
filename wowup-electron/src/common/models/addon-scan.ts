import { Addon, AddonFolder, AddonScanResult, AddonSearchResult, AddonWarningType } from "wowup-lib-core";

/** Which fingerprint a scan should produce. One folder can be asked for both at once. */
export type AddonScanSource = "wowup" | "curseforge";

export interface AddonScanRequest {
  filePaths: string[];
  sources: AddonScanSource[];
}

/** Every fingerprint that was asked for, for one addon folder. */
export interface FolderScanResults {
  path: string;
  wowup?: AddonScanResult;
  curseforge?: AddonScanResult;
}

/**
 * Ask main to list an installation's addon folders and get them ready for the providers to match.
 * Main works out the folder path, the symlink setting and which fingerprints this build needs.
 */
export interface PrepareAddonScanRequest {
  installationId: string;
  /**
   * Providers whose addons a scan can't find again (e.g. GitHub, Zip). When given, the folders of the
   * installation's saved addons from these are left out of the scan. Leave it out to scan every folder.
   */
  nonRescanProviders?: string[];
}

export interface PreparedAddonScan {
  /** Fingerprinted folders; ones the providers should skip carry an ignoreReason */
  addonFolders: AddonFolder[];
}

/** Hand main the folders once the providers have set their matchingAddon */
export interface CompleteAddonScanRequest {
  installationId: string;
  addonFolders: AddonFolder[];
  /** Every provider this build has, which decides which toc ids become external ids */
  providerNames: string[];
  /** As given to prepare: the saved addons of these providers are carried over unchanged */
  nonRescanProviders?: string[];
  /**
   * Replace the installation's saved addons with the result, keeping the user's settings for the ones
   * that were already there. Leave it off to only read what's on disk.
   */
  save: boolean;
}

/** What a provider reported against one of its addon ids instead of a result */
export interface AddonSyncFailure {
  addonId?: string;
  /** Set when the provider gave a warning to show on the addon (a GenericProviderError) */
  warningType?: AddonWarningType;
}

/** One provider's answer for a set of an installation's addons */
export interface ApplyAddonSyncRequest {
  providerName: string;
  /**
   * The addons the provider was asked about. Main applies the answer to its own saved copy of each, so
   * a change saved since the caller read them isn't overwritten; one not saved yet (an install still
   * running) is updated from this copy and returned, but not saved.
   */
  addons: Addon[];
  searchResults: AddonSearchResult[];
  failures: AddonSyncFailure[];
}

export interface AppliedAddonSync {
  /** The addons from the request after the results were applied, matched by id */
  addons: Addon[];
  /** Per failure in the request, by index, the name of the addon it was about */
  failureAddonNames: Array<string | undefined>;
  /** Addons the provider returned no file for, which were flagged NoProviderFiles */
  noFileAddons: Array<{ name: string; providerName: string }>;
}
