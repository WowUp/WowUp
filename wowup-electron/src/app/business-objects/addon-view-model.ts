import * as _ from "lodash";
import { AddonInstallState } from "../models/wowup/addon-install-state";
import { AddonStatusSortOrder } from "../models/wowup/addon-status-sort-order";
import * as AddonUtils from "../utils/addon.utils";
import { ADDON_PROVIDER_UNKNOWN } from "../../common/constants";
import * as objectHash from "object-hash";
import { Addon, AddonChannelType, AddonDependency, AddonDependencyType } from "wowup-lib-core";

export class AddonViewModel {
  public addon: Addon | undefined;

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
  public canonicalName = "";

  public get isIgnored(): boolean {
    return this.addon?.isIgnored ?? false;
  }

  public get name(): string {
    return this.addon?.name ?? "";
  }

  public get latestVersion(): string {
    return this.addon?.latestVersion ?? "";
  }

  public get gameVersion(): string[] {
    return this.addon?.gameVersion ?? [];
  }

  public get externalChannel(): string {
    return this.addon?.externalChannel ?? "";
  }

  public get providerName(): string {
    return this.addon?.providerName ?? "";
  }

  public get author(): string {
    return this.addon?.author ?? "";
  }

  public get hash(): string {
    return objectHash(this.addon);
  }

  public constructor(addon: Addon | undefined) {
    this.addon = addon;
    this.installedAt = addon?.installedAt ? new Date(addon?.installedAt).getTime() : 0;
    this.releasedAt = addon?.releasedAt ? new Date(addon?.releasedAt).getTime() : 0;
    this.stateTextTranslationKey = this.getStateTextTranslationKey();
    this.isLoadOnDemand = addon?.isLoadOnDemand ?? false;
    this.hasThumbnail = !!addon?.thumbnailUrl;
    this.thumbnailLetter = addon?.name?.charAt(0).toUpperCase() ?? "";
    this.canonicalName = addon?.name?.toLowerCase() ?? "";
  }

  public isUpToDate(): boolean {
    return !this.isInstalling && !AddonUtils.needsUpdate(this.addon);
  }

  public isStableChannel(): boolean {
    return this.addon?.channelType === AddonChannelType.Stable;
  }

  public isBetaChannel(): boolean {
    return this.addon?.channelType === AddonChannelType.Beta;
  }

  public isAlphaChannel(): boolean {
    return this.addon?.channelType === AddonChannelType.Alpha;
  }

  public isUnMatched(): boolean {
    return this.addon?.providerName === ADDON_PROVIDER_UNKNOWN;
  }

  public clone(): AddonViewModel {
    return new AddonViewModel(this.addon);
  }

  public onClicked(): void {
    this.selected = !this.selected;
  }

  public needsInstall(): boolean {
    return !this.isInstalling && this.addon !== undefined && AddonUtils.needsInstall(this.addon);
  }

  public needsUpdate(): boolean {
    return !this.isInstalling && this.addon !== undefined && AddonUtils.needsUpdate(this.addon);
  }

  public get sortOrder(): AddonStatusSortOrder {
    if (this.addon?.isIgnored) {
      return AddonStatusSortOrder.Ignored;
    }

    if (this.addon?.warningType) {
      return AddonStatusSortOrder.Warning;
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

    if (this.addon?.isIgnored) {
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

  public getDependencies(dependencyType: AddonDependencyType | undefined = undefined): AddonDependency[] {
    return (
      (dependencyType == undefined
        ? this.addon?.dependencies ?? []
        : _.filter(this.addon?.dependencies ?? [], (dep) => dep.type === dependencyType)) ?? []
    );
  }
}
