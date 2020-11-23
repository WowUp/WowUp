import * as _ from "lodash";
import { AddonDependencyType } from "../models/wowup/addon-dependency-type";
import { Addon } from "../entities/addon";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonInstallState } from "../models/wowup/addon-install-state";
import { AddonStatusSortOrder } from "../models/wowup/addon-status-sort-order";
import * as AddonUtils from "../utils/addon.utils";

export class AddonViewModel {
  public addon: Addon;

  public installState: AddonInstallState = AddonInstallState.Unknown;
  public isInstalling: boolean = false;
  public installProgress: number = 0;
  public stateTextTranslationKey: string = "";
  public selected: boolean = false;

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
    return !this.isInstalling && AddonUtils.needsInstall(this.addon);
  }

  get needsUpdate() {
    return !this.isInstalling && AddonUtils.needsUpdate(this.addon);
  }

  get isAutoUpdate() {
    return this.addon.autoUpdateEnabled;
  }

  get isUpToDate() {
    return !this.isInstalling && !AddonUtils.needsUpdate(this.addon);
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

    if (this.needsUpdate || this.isInstalling) {
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

    console.warn("Unhandled display state", this.isUpToDate, JSON.stringify(this, null, 2));
    return "COMMON.ADDON_STATE.UNKNOWN";
  }

  public getDependencies(dependencyType: AddonDependencyType = undefined) {
    return dependencyType == undefined
      ? this.addon.dependencies
      : _.filter(this.addon.dependencies, (dep) => dep.type === dependencyType);
  }
}
