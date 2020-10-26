import { Addon } from "app/entities/addon";
import { AddonChannelType } from "app/models/wowup/addon-channel-type";
import { AddonInstallState } from "app/models/wowup/addon-install-state";
import { AddonDisplayState } from "../models/wowup/addon-display-state";

export class AddonViewModel {
  public addon: Addon;

  public installState: AddonInstallState = AddonInstallState.Unknown;
  public isInstalling: boolean = false;
  public installProgress: number = 0;
  public stateTextTranslationKey: string = "";
  public selected: boolean = false;

  get hasThumbnail() {
    return !!this.addon.thumbnailUrl;
  }

  get thumbnailLetter() {
    return this.addon.name.charAt(0).toUpperCase();
  }

  get needsInstall() {
    return (
      !this.isInstalling && this.displayState === AddonDisplayState.Install
    );
  }

  get needsUpdate() {
    return !this.isInstalling && this.displayState === AddonDisplayState.Update;
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
    return this.displayState === AddonDisplayState.Ignored;
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

  get displayState(): AddonDisplayState {
    if (this.addon.isIgnored) {
      return AddonDisplayState.Ignored;
    }

    if (!this.addon.installedVersion) {
      return AddonDisplayState.Install;
    }

    if (this.addon.installedVersion !== this.addon.latestVersion) {
      return AddonDisplayState.Update;
    }

    if (this.addon.installedVersion === this.addon.latestVersion) {
      return AddonDisplayState.UpToDate;
    }

    return AddonDisplayState.Unknown;
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

  public getStateTextTranslationKey() {
    switch (this.displayState) {
      case AddonDisplayState.UpToDate:
        return "COMMON.ADDON_STATE.UPTODATE";
      case AddonDisplayState.Ignored:
        return "COMMON.ADDON_STATE.IGNORED";
      case AddonDisplayState.Update:
        return "COMMON.ADDON_STATE.UPDATE";
      case AddonDisplayState.Install:
        return "COMMON.ADDON_STATE.INSTALL";
      case AddonDisplayState.Unknown:
      default:
        console.log("Unhandled display state", this.displayState);
        return "COMMON.ADDON_STATE.UNKNOWN";
    }
  }
}
