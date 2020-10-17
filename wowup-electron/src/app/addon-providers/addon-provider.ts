import { WowClientType } from "../models/warcraft/wow-client-type";
import { Addon } from "../entities/addon";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { Observable } from "rxjs";
import { AddonFolder } from "app/models/wowup/addon-folder";
import { AddonChannelType } from "app/models/wowup/addon-channel-type";

export interface AddonProvider {
  name: AddonProviderType;

  getAll(
    clientType: WowClientType,
    addonIds: string[]
  ): Promise<AddonSearchResult[]>;

  getFeaturedAddons(clientType: WowClientType): Promise<AddonSearchResult[]>;

  searchByQuery(
    query: string,
    clientType: WowClientType
  ): Promise<AddonSearchResult[]>;

  searchByUrl(
    addonUri: URL,
    clientType: WowClientType
  ): Promise<AddonSearchResult>;

  searchByName(
    addonName: string,
    folderName: string,
    clientType: WowClientType,
    nameOverride?: string
  ): Promise<AddonSearchResult[]>;

  getById(
    addonId: string,
    clientType: WowClientType
  ): Observable<AddonSearchResult>;

  isValidAddonUri(addonUri: URL): boolean;

  onPostInstall(addon: Addon): void;

  scan(
    clientType: WowClientType,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void>;
}

export type AddonProviderType =
  | "Curse"
  | "GitHub"
  | "TukUI"
  | "WowInterface"
  | "WowUp";
