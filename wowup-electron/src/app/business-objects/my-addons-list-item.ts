import { Addon } from "app/entities/addon";
import { AddonChannelType } from "app/models/wowup/addon-channel-type";
import { AddonInstallState } from "app/models/wowup/addon-install-state";
import { AddonDisplayState } from "../models/wowup/addon-display-state";

export class AddonModel {
  addon: Addon;

  installProgress = 0;
  statusText = "";
  selected = false;
  isInstalling = false;

  get needsInstall() {
    return (
      !this.isInstalling && this.displayState === AddonDisplayState.Install
    );
  }

  get needsUpdate() {
    return !this.isInstalling && this.displayState === AddonDisplayState.Update;
  }

  get isUpToDate() {
    return (
      !this.isInstalling && this.displayState === AddonDisplayState.UpToDate
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

    if (this.addon.installedVersion != this.addon.latestVersion) {
      return AddonDisplayState.Update;
    }

    if (this.addon.installedVersion === this.addon.latestVersion) {
      return AddonDisplayState.UpToDate;
    }

    return AddonDisplayState.Unknown;
  }

  constructor(addon?: Addon) {
    this.addon = addon;
    this.statusText = this.getDisplayStateText();
    if (!this.addon.thumbnailUrl) {
      this.addon.thumbnailUrl = "assets/wowup_logo_512np.png";
    }
  }

  public getDisplayStateText(): string {
    switch (this.displayState) {
      case AddonDisplayState.UpToDate:
        return "Up to Date";
      case AddonDisplayState.Ignored:
        return "Ignored";
      case AddonDisplayState.Update:
        return "Update";
      case AddonDisplayState.Install:
        return "Install";
      case AddonDisplayState.Unknown:
      default:
        return "";
    }
  }

  public setStatusText(installState: AddonInstallState): void {
    switch (installState) {
      case AddonInstallState.Pending:
        this.statusText = "Pending";
        break;
      case AddonInstallState.Downloading:
        this.statusText = "Downloading";
        break;
      case AddonInstallState.BackingUp:
        this.statusText = "BackingUp";
        break;
      case AddonInstallState.Installing:
        this.statusText = "Installing";
        break;
      case AddonInstallState.Complete:
        this.statusText = "Complete";
        break;
      case AddonInstallState.Removed:
        this.statusText = "Removed";
        break;
      default:
        this.statusText = "Unknown";
        break;
    }
  }

  public updateInstallState(installState: AddonInstallState): void {
    this.isInstalling =
      installState === AddonInstallState.Installing ||
      installState === AddonInstallState.Downloading;
  }
}
