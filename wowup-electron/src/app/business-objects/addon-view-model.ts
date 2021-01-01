import * as _ from "lodash";
import { AddonDependencyType } from "../models/wowup/addon-dependency-type";
import { Addon } from "../entities/addon";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonInstallState } from "../models/wowup/addon-install-state";
import { AddonStatusSortOrder } from "../models/wowup/addon-status-sort-order";
import * as AddonUtils from "../utils/addon.utils";
import { ADDON_PROVIDER_UNKNOWN } from "../../common/constants";

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
    return !this.isInstalling && AddonUtils.needsInstall(this.addon);
  }

  get needsUpdate() {
    return !this.isInstalling && AddonUtils.needsUpdate(this.addon);
  }

  constructor(addon?: Addon) {
    this.addon = addon;
    this.stateTextTranslationKey = this.getStateTextTranslationKey();
  }

  public isUpToDate() {
    return !this.isInstalling && !AddonUtils.needsUpdate(this.addon);
  }

  public isStableChannel() {
    return this.addon.channelType === AddonChannelType.Stable;
  }

  public isBetaChannel() {
    return this.addon.channelType === AddonChannelType.Beta;
  }

  public isAlphaChannel() {
    return this.addon.channelType === AddonChannelType.Alpha;
  }

  public isUnMatched() {
    return this.addon.providerName === ADDON_PROVIDER_UNKNOWN;
  }

  public clone() {
    return new AddonViewModel(this.addon);
  }

  public onClicked() {
    this.selected = !this.selected;
  }

  public get sortOrder(): AddonStatusSortOrder {
    if (this.addon.isIgnored) {
      return AddonStatusSortOrder.Ignored;
    }

    if (this.needsInstall) {
      return AddonStatusSortOrder.Install;
    }

    if (this.needsUpdate || this.isInstalling) {
      return AddonStatusSortOrder.Update;
    }

    if (this.isUpToDate()) {
      return AddonStatusSortOrder.UpToDate;
    }

    return AddonStatusSortOrder.Unknown;
  }

  public getStateTextTranslationKey() {
    if (this.isUpToDate()) {
      return "COMMON.ADDON_STATE.UPTODATE";
    }

    if (this.addon.isIgnored) {
      return "COMMON.ADDON_STATE.IGNORED";
    }

    if (this.needsUpdate) {
      return "COMMON.ADDON_STATE.UPDATE";
    }

    if (this.needsInstall) {
      return "COMMON.ADDON_STATE.INSTALL";
    }

    console.warn("Unhandled display state", this.isUpToDate(), JSON.stringify(this, null, 2));
    return "COMMON.ADDON_STATE.UNKNOWN";
  }

  public getDependencies(dependencyType: AddonDependencyType = undefined) {
    return dependencyType == undefined
      ? this.addon.dependencies
      : _.filter(this.addon.dependencies, (dep) => dep.type === dependencyType);
  }
}
