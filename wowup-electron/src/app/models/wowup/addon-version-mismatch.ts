import { Addon, WowInstallation } from "wowup-lib-core";

/** An addon whose pending update needs a newer game version than its installation currently runs */
export interface AddonVersionMismatch {
  addon: Addon;
  installation: WowInstallation;
}

export interface AutoUpdateResult {
  updated: Addon[];
  /** Addons with an update that was held back because of a game version mismatch */
  skipped: Addon[];
}
