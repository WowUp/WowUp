import { WowClientType } from "../models/warcraft/wow-client-type";
import { Addon } from "../entities/addon";
import { PotentialAddon } from "../models/wowup/potential-addon";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { Observable } from "rxjs";
import { AddonFolder } from "app/models/wowup/addon-folder";
import { AddonChannelType } from "app/models/wowup/addon-channel-type";

export interface AddonProvider {

  name: string;

  getAll(clientType: WowClientType, addonIds: string[]): Promise<AddonSearchResult[]>;

  getFeaturedAddons(clientType: WowClientType): Observable<PotentialAddon[]>;

  searchByQuery(query: string, clientType: WowClientType): Promise<PotentialAddon[]>;

  searchByUrl(addonUri: URL, clientType: WowClientType): Promise<PotentialAddon>;

  searchByName(addonName: string, folderName: string, clientType: WowClientType, nameOverride?: string): Promise<AddonSearchResult[]>;

  getById(addonId: string, clientType: WowClientType): Observable<AddonSearchResult>;

  isValidAddonUri(addonUri: URL): boolean;

  onPostInstall(addon: Addon): void;

  scan(clientType: WowClientType, addonChannelType: AddonChannelType, addonFolders: AddonFolder[]): Promise<void>;
}