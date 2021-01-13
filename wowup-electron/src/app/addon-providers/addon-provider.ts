import { Observable, of } from "rxjs";

import { Addon } from "../entities/addon";
import { WowClientType } from "../models/warcraft/wow-client-type";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonFolder } from "../models/wowup/addon-folder";
import { AddonSearchResult } from "../models/wowup/addon-search-result";

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

  async getAll(clientType: WowClientType, addonIds: string[]): Promise<GetAllResult> {
    return {
      errors: [],
      searchResults: [],
    };
  }

  async getFeaturedAddons(clientType: WowClientType, channelType?: AddonChannelType): Promise<AddonSearchResult[]> {
    return [];
  }

  async searchByQuery(
    query: string,
    clientType: WowClientType,
    channelType?: AddonChannelType
  ): Promise<AddonSearchResult[]> {
    return [];
  }

  async searchByUrl(addonUri: URL, clientType: WowClientType): Promise<AddonSearchResult | undefined> {
    return undefined;
  }

  async searchByName(
    addonName: string,
    folderName: string,
    clientType: WowClientType,
    nameOverride?: string
  ): Promise<AddonSearchResult[]> {
    return [];
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

  async getChangelog(clientType: WowClientType, externalId: string, externalReleaseId: string): Promise<string> {
    return "";
  }

  async getDescription(clientType: WowClientType, externalId: string): Promise<string> {
    return "";
  }
}

export type AddonProviderType = "Curse" | "GitHub" | "TukUI" | "WowInterface" | "Hub" | "RaiderIO";
