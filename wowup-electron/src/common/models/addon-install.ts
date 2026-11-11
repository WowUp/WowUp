import { Addon } from "wowup-lib-core";

/** Install a downloaded addon zip over whatever version of the addon is in its AddOns folder */
export interface InstallAddonFileRequest {
  /** The addon as the provider describes the version being installed */
  addon: Addon;
  /** The downloaded zip. Main deletes it once the install is over, whether or not it worked. */
  zipFilePath: string;
  /** The addon being replaced, when switching an addon to another provider */
  originalAddon?: Addon;
  /** The provider's `forceIgnore`: its addons never update on their own */
  forceIgnore: boolean;
  /** The providers this build has, for deciding which external ids are kept */
  providerNames: string[];
}

export interface InstalledAddonFile {
  /** The addon as saved */
  addon: Addon;
  /** Unknown addons dropped because the install now owns their folders */
  removedAddons: Addon[];
}

export type AddonInstallPhase = "backingUp" | "installing";

/** Sent on IPC_ADDON_INSTALL_PROGRESS while an install runs in main */
export interface AddonInstallProgress {
  addonId: string;
  phase: AddonInstallPhase;
}

export interface RemoveAddonRequest {
  /** Main removes its saved copy when it has one, so the folders removed are the ones last saved */
  addon: Addon;
  /** Also remove the addons this one depends on, found by their external id with the same provider */
  removeDependencies: boolean;
  /** False to forget the addon but leave its folders on disk */
  removeDirectories: boolean;
}

export interface RemovedAddons {
  /** Every addon removed, the requested one first, then any dependencies */
  removedAddons: Addon[];
}

/** Add one provider id to a saved addon's external ids */
export interface AddExternalIdRequest {
  addonId: string;
  providerName: string;
  externalId: string;
}
