import * as _ from "lodash";
import { AddonDependencyType } from "../models/wowup/addon-dependency-type";
import { Addon } from "../entities/addon";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonInstallState } from "../models/wowup/addon-install-state";
import { AddonStatusSortOrder } from "../models/wowup/addon-status-sort-order";
import * as AddonUtils from "../utils/addon.utils";
import { ADDON_PROVIDER_UNKNOWN } from "../../common/constants";
import { AddonDependency } from "../models/wowup/addon-dependency";

export class AddonViewModel {
  public addon: Addon;

  public installState: AddonInstallState = AddonInstallState.Unknown;
  public isInstalling = false;
  public installProgress = 0;
  public stateTextTranslationKey = "";
  public selected = false;
  public releasedAt = 0;
  public installedAt = 0;
  public isLoadOnDemand = false;
  public hasThumbnail = false;
  public thumbnailLetter = "";

  constructor(addon?: Addon) {
    this.addon = addon;
    this.installedAt = addon.installedAt ? new Date(addon.installedAt).getTime() : 0;
    this.releasedAt = addon.releasedAt ? new Date(addon.releasedAt).getTime() : 0;
    this.stateTextTranslationKey = this.getStateTextTranslationKey();
    this.isLoadOnDemand = addon.isLoadOnDemand;
    this.hasThumbnail = !!addon.thumbnailUrl;
    this.thumbnailLetter = this.addon.name?.charAt(0).toUpperCase() ?? "";
  }

  public isUpToDate(): boolean {
    return !this.isInstalling && !AddonUtils.needsUpdate(this.addon);
  }

  public isStableChannel(): boolean {
    return this.addon.channelType === AddonChannelType.Stable;
  }

  public isBetaChannel(): boolean {
    return this.addon.channelType === AddonChannelType.Beta;
  }

  public isAlphaChannel(): boolean {
    return this.addon.channelType === AddonChannelType.Alpha;
  }

  public isUnMatched(): boolean {
    return this.addon.providerName === ADDON_PROVIDER_UNKNOWN;
  }

  public clone(): AddonViewModel {
    return new AddonViewModel(this.addon);
  }

  public onClicked(): void {
    this.selected = !this.selected;
  }

  public needsInstall(): boolean {
    return !this.isInstalling && AddonUtils.needsInstall(this.addon);
  }

  public needsUpdate(): boolean {
    return !this.isInstalling && AddonUtils.needsUpdate(this.addon);
  }

  public get sortOrder(): AddonStatusSortOrder {
    if (this.addon.isIgnored) {
      return AddonStatusSortOrder.Ignored;
    }

    if (this.needsInstall()) {
      return AddonStatusSortOrder.Install;
    }

    if (this.needsUpdate() || this.isInstalling) {
      return AddonStatusSortOrder.Update;
    }

    if (this.isUpToDate()) {
      return AddonStatusSortOrder.UpToDate;
    }

    return AddonStatusSortOrder.Unknown;
  }

  public getStateTextTranslationKey(): string {
    if (this.isUpToDate()) {
      return "COMMON.ADDON_STATE.UPTODATE";
    }

    if (this.addon.isIgnored) {
      return "COMMON.ADDON_STATE.IGNORED";
    }

    if (this.needsUpdate()) {
      return "COMMON.ADDON_STATE.UPDATE";
    }

    if (this.needsInstall()) {
      return "COMMON.ADDON_STATE.INSTALL";
    }

    console.warn("Unhandled display state", this.isUpToDate(), JSON.stringify(this, null, 2));
    return "COMMON.ADDON_STATE.UNKNOWN";
  }

  public getDependencies(dependencyType: AddonDependencyType = undefined): AddonDependency[] {
    return dependencyType == undefined
      ? this.addon.dependencies
      : _.filter(this.addon.dependencies, (dep) => dep.type === dependencyType);
  }
}
