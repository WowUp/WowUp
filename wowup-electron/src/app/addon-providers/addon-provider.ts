import { Observable } from "rxjs";
import { Addon } from "../entities/addon";
import { WowClientType } from "../models/warcraft/wow-client-type";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonFolder } from "../models/wowup/addon-folder";
import { AddonSearchResult } from "../models/wowup/addon-search-result";

export interface AddonProvider {
  name: AddonProviderType;

  getAll(clientType: WowClientType, addonIds: string[]): Promise<AddonSearchResult[]>;

  getFeaturedAddons(clientType: WowClientType, channelType?: AddonChannelType): Promise<AddonSearchResult[]>;

  searchByQuery(query: string, clientType: WowClientType, channelType?: AddonChannelType): Promise<AddonSearchResult[]>;

  searchByUrl(addonUri: URL, clientType: WowClientType): Promise<AddonSearchResult>;

  searchByName(
    addonName: string,
    folderName: string,
    clientType: WowClientType,
    nameOverride?: string
  ): Promise<AddonSearchResult[]>;

  getById(addonId: string, clientType: WowClientType): Observable<AddonSearchResult>;

  isValidAddonUri(addonUri: URL): boolean;
  isValidAddonId(addonId: string): boolean;

  onPostInstall(addon: Addon): void;

  scan(clientType: WowClientType, addonChannelType: AddonChannelType, addonFolders: AddonFolder[]): Promise<void>;
}

export type AddonProviderType = "Curse" | "GitHub" | "TukUI" | "WowInterface" | "WowUp";
