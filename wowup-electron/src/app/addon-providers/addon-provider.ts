/* eslint-disable @typescript-eslint/no-unused-vars */
import { WowInstallation } from "../../common/warcraft/wow-installation";
import { Observable, of } from "rxjs";

import { Addon } from "../../common/entities/addon";
import { AddonCategory, AddonChannelType, AdPageOptions } from "../../common/wowup/models";
import { AddonFolder } from "../models/wowup/addon-folder";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { ProtocolSearchResult } from "../models/wowup/protocol-search-result";
import { DownloadAuth } from "../../common/models/download-request";

export type AddonProviderType =
  | "Curse"
  | "CurseV2"
  | "GitHub"
  | "TukUI"
  | "WowInterface"
  | "WowUpHub"
  | "RaiderIO"
  | "Zip"
  | "WowUpCompanion"
  | "Wago";

export interface GetAllBatchResult {
  installationResults: { [installationId: string]: AddonSearchResult[] };
  errors: { [installationId: string]: Error[] };
}

export interface GetAllResult {
  searchResults: AddonSearchResult[];
  errors: Error[];
}

export interface SearchByUrlResult {
  searchResult?: AddonSearchResult;
  errors?: Error[];
}

export abstract class AddonProvider {
  public name: AddonProviderType = "Zip";
  public enabled = false;
  public forceIgnore = true;
  public allowReinstall = false;
  public allowChannelChange = false;
  public allowEdit = false;
  public allowViewAtSource = true;
  public allowReScan = true;
  public canShowChangelog = true;
  public canBatchFetch = false;
  public authRequired = false;
  public adRequired = false;
  public providerNote = "";

  public getAllBatch(installations: WowInstallation[], addonIds: string[]): Promise<GetAllBatchResult> {
    return Promise.resolve({
      errors: {},
      installationResults: {},
    });
  }

  public getAll(installation: WowInstallation, addonIds: string[]): Promise<GetAllResult> {
    return Promise.resolve({
      errors: [],
      searchResults: [],
    });
  }

  public getFeaturedAddons(
    installation: WowInstallation,
    channelType?: AddonChannelType
  ): Promise<AddonSearchResult[]> {
    return Promise.resolve([]);
  }

  public shouldMigrate(addon: Addon): boolean {
    return false;
  }

  public searchByQuery(
    query: string,
    installation: WowInstallation,
    channelType?: AddonChannelType
  ): Promise<AddonSearchResult[]> {
    return Promise.resolve([]);
  }

  public searchByUrl(addonUri: URL, installation: WowInstallation): Promise<SearchByUrlResult> {
    return Promise.resolve({});
  }

  public searchProtocol(protocol: string): Promise<ProtocolSearchResult | undefined> {
    return Promise.resolve(undefined);
  }

  public getCategory(category: AddonCategory, installation: WowInstallation): Promise<AddonSearchResult[]> {
    return Promise.resolve([]);
  }

  public getById(addonId: string, installation: WowInstallation): Observable<AddonSearchResult | undefined> {
    return of(undefined);
  }

  public isValidAddonUri(addonUri: URL): boolean {
    return false;
  }

  public isValidAddonId(addonId: string): boolean {
    return false;
  }

  public isValidProtocol(protocol: string): boolean {
    return false;
  }

  public async scan(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {}

  public getChangelog(installation: WowInstallation, externalId: string, externalReleaseId: string): Promise<string> {
    return Promise.resolve("");
  }

  public async getDescription(installation: WowInstallation, externalId: string, addon?: Addon): Promise<string> {
    return Promise.resolve("");
  }

  public getAdPageParams(): AdPageOptions | undefined {
    return undefined;
  }

  public getDownloadAuth(): DownloadAuth | undefined {
    return undefined;
  }
}
