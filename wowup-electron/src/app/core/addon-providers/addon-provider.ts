import { WowClientType } from "app/models/warcraft/wow-client-type";
import { Addon } from "../entities/addon";
import { PotentialAddon } from "app/models/wowup/potential-addon";
import { AddonSearchResult } from "app/models/wowup/addon-search-result";

export interface AddonProvider {

    name: string;

    getAll(clientType: WowClientType, addonIds: string[]): Promise<AddonSearchResult[]>;

    getFeaturedAddons(clientType: WowClientType): Promise<PotentialAddon[]>;

    searchByQuery(query: string, clientType: WowClientType): Promise<PotentialAddon[]>;

    searchByUrl(addonUri: URL, clientType: WowClientType): Promise<PotentialAddon>;

    searchByName(addonName: string, folderName: string, clientType: WowClientType, nameOverride?: string): Promise<AddonSearchResult[]>;

    getById(addonId: string, clientType: WowClientType): Promise<AddonSearchResult>;

    isValidAddonUri(addonUri: URL): boolean;

    onPostInstall(addon: Addon): void;
}