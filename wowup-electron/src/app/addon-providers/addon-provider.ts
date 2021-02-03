/* eslint-disable @typescript-eslint/no-unused-vars */
import { Observable, of } from "rxjs";

import { Addon } from "../entities/addon";
import { WowClientType } from "../models/warcraft/wow-client-type";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonFolder } from "../models/wowup/addon-folder";
import { AddonSearchResult } from "../models/wowup/addon-search-result";

export type AddonProviderType = "Curse" | "GitHub" | "TukUI" | "WowInterface" | "WowUpHub" | "RaiderIO" | "Zip";

export interface GetAllResult {
  searchResults: AddonSearchResult[];
  errors: Error[];
}

export abstract class AddonProvider {
  name: AddonProviderType;
  enabled: boolean;
  forceIgnore: boolean;
  allowReinstall: boolean;
  allowChannelChange: boolean;
  allowEdit: boolean;
  allowViewAtSource = true;
  canShowChangelog = true;

  getAll(clientType: WowClientType, addonIds: string[]): Promise<GetAllResult> {
    return Promise.resolve({
      errors: [],
      searchResults: [],
    });
  }

  getFeaturedAddons(clientType: WowClientType, channelType?: AddonChannelType): Promise<AddonSearchResult[]> {
    return Promise.resolve([]);
  }

  searchByQuery(
    query: string,
    clientType: WowClientType,
    channelType?: AddonChannelType
  ): Promise<AddonSearchResult[]> {
    return Promise.resolve([]);
  }

  searchByUrl(addonUri: URL, clientType: WowClientType): Promise<AddonSearchResult | undefined> {
    return Promise.resolve(undefined);
  }

  searchByName(
    addonName: string,
    folderName: string,
    clientType: WowClientType,
    nameOverride?: string
  ): Promise<AddonSearchResult[]> {
    return Promise.resolve([]);
  }

  getById(addonId: string, clientType: WowClientType): Observable<AddonSearchResult> {
    return of(undefined);
  }

  isValidAddonUri(addonUri: URL): boolean {
    return false;
  }

  isValidAddonId(addonId: string): boolean {
    return false;
  }

  onPostInstall(addon: Addon): void {}

  async scan(
    clientType: WowClientType,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {}

  getChangelog(clientType: WowClientType, externalId: string, externalReleaseId: string): Promise<string> {
    return Promise.resolve("");
  }

  async getDescription(clientType: WowClientType, externalId: string, addon?: Addon): Promise<string> {
    return Promise.resolve("");
  }
}
