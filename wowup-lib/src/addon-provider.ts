/* eslint-disable  @typescript-eslint/no-unused-vars */
import { WowInstallation } from './models';
import { Addon, AddonFolder, AddonSearchResult, ProtocolSearchResult } from './addons';
import { AddonCategory, AddonChannelType, AddonProviderType } from './types';

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

export interface AdPageOptions {
  pageUrl: string;
  referrer?: string;
  userAgent?: string;
  partition?: string;
  preloadFilePath?: string;
  explanationKey?: string; // locale key of the translated explanation of this ad
}

export interface DownloadAuth {
  headers?: { [key: string]: string };
  queryParams?: { [key: string]: string };
}

export abstract class AddonProvider {
  public name: AddonProviderType = 'Unknown';
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
  public providerNote = '';

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
    channelType?: AddonChannelType,
  ): Promise<AddonSearchResult[]> {
    return Promise.resolve([]);
  }

  public shouldMigrate(addon: Addon): boolean {
    return false;
  }

  public searchByQuery(
    query: string,
    installation: WowInstallation,
    channelType?: AddonChannelType,
  ): Promise<AddonSearchResult[]> {
    return Promise.resolve([]);
  }

  public searchByUrl(addonUri: URL, installation: WowInstallation): Promise<SearchByUrlResult | undefined> {
    return Promise.resolve(undefined);
  }

  public searchProtocol(protocol: string): Promise<ProtocolSearchResult | undefined> {
    return Promise.resolve(undefined);
  }

  public getCategory(category: AddonCategory, installation: WowInstallation): Promise<AddonSearchResult[]> {
    return Promise.resolve([]);
  }

  public getById(addonId: string, installation: WowInstallation): Promise<AddonSearchResult | undefined> {
    return Promise.resolve(undefined);
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

  public scan(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[],
  ): Promise<void> {
    return Promise.resolve(undefined);
  }

  public getChangelog(installation: WowInstallation, externalId: string, externalReleaseId: string): Promise<string> {
    return Promise.resolve('');
  }

  public async getDescription(installation: WowInstallation, externalId: string, addon?: Addon): Promise<string> {
    return Promise.resolve('');
  }

  public getAdPageParams(): AdPageOptions | undefined {
    return undefined;
  }

  public getDownloadAuth(): Promise<DownloadAuth | undefined> {
    return Promise.resolve(undefined);
  }
}
