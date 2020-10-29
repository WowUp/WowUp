import { Addon } from "../entities/addon";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonInstallState } from "../models/wowup/addon-install-state";
import { AddonStatusSortOrder } from "../models/wowup/addon-status-sort-order";

export class AddonViewModel {
  public addon: Addon;

  public installState: AddonInstallState = AddonInstallState.Unknown;
  public isInstalling: boolean = false;
  public installProgress: number = 0;
  public stateTextTranslationKey: string = "";
  public selected: boolean = false;

  get isLoadOnDemand() {
    return this.addon?.isLoadOnDemand;
  }

  get installedAt() {
    return new Date(this.addon?.installedAt);
  }
  get hasThumbnail() {
    return !!this.addon.thumbnailUrl;
  }

  get thumbnailLetter() {
    return this.addon.name.charAt(0).toUpperCase();
  }

  get needsInstall() {
    return !this.isInstalling && !this.addon.installedVersion;
  }

  get needsUpdate() {
    return (
      !this.isInstalling &&
      this.addon.installedVersion !== this.addon.latestVersion
    );
  }

  get isAutoUpdate() {
    return this.addon.autoUpdateEnabled;
  }

  get isUpToDate() {
    return (
      !this.isInstalling &&
      this.addon.installedVersion === this.addon.latestVersion
    );
  }

  get isIgnored() {
    return this.addon.isIgnored;
  }

  get isStableChannel() {
    return this.addon.channelType === AddonChannelType.Stable;
  }

  get isBetaChannel() {
    return this.addon.channelType === AddonChannelType.Beta;
  }

  get isAlphaChannel() {
    return this.addon.channelType === AddonChannelType.Alpha;
  }

  constructor(addon?: Addon) {
    this.addon = addon;
    this.stateTextTranslationKey = this.getStateTextTranslationKey();
  }

  public clone() {
    return new AddonViewModel(this.addon);
  }

  public onClicked() {
    this.selected = !this.selected;
  }

  public get sortOrder(): AddonStatusSortOrder {
    if (this.isIgnored) {
      return AddonStatusSortOrder.Ignored;
    }

    if (this.needsInstall) {
      return AddonStatusSortOrder.Install;
    }

    if (this.needsUpdate) {
      return AddonStatusSortOrder.Update;
    }

    if (this.isUpToDate) {
      return AddonStatusSortOrder.UpToDate;
    }

    return AddonStatusSortOrder.Unknown;
  }

  public getStateTextTranslationKey() {
    if (this.isUpToDate) {
      return "COMMON.ADDON_STATE.UPTODATE";
    }

    if (this.isIgnored) {
      return "COMMON.ADDON_STATE.IGNORED";
    }

    if (this.needsUpdate) {
      return "COMMON.ADDON_STATE.UPDATE";
    }

    if (this.needsInstall) {
      return "COMMON.ADDON_STATE.INSTALL";
    }

    console.log("Unhandled display state");
    return "COMMON.ADDON_STATE.UNKNOWN";
  }
}
