/* eslint-disable @typescript-eslint/no-unused-vars */
import { WowInstallation } from "../models/wowup/wow-installation";
import { Observable, of } from "rxjs";

import { Addon } from "../../common/entities/addon";
import { AddonCategory, AddonChannelType } from "../../common/wowup/models";
import { AddonFolder } from "../models/wowup/addon-folder";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { ProtocolSearchResult } from "../models/wowup/protocol-search-result";

export type AddonProviderType = "Curse" | "GitHub" | "TukUI" | "WowInterface" | "WowUpHub" | "RaiderIO" | "Zip";

export interface GetAllResult {
  searchResults: AddonSearchResult[];
  errors: Error[];
}

export abstract class AddonProvider {
  public name: AddonProviderType;
  public enabled: boolean;
  public forceIgnore: boolean;
  public allowReinstall: boolean;
  public allowChannelChange: boolean;
  public allowEdit: boolean;
  public allowViewAtSource = true;
  public canShowChangelog = true;

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

  public searchByUrl(addonUri: URL, installation: WowInstallation): Promise<AddonSearchResult | undefined> {
    return Promise.resolve(undefined);
  }

  public searchProtocol(protocol: string): Promise<ProtocolSearchResult | undefined> {
    return Promise.resolve(undefined);
  }

  public getCategory(category: AddonCategory, installation: WowInstallation): Promise<AddonSearchResult[]> {
    return Promise.resolve([]);
  }

  public getById(addonId: string, installation: WowInstallation): Observable<AddonSearchResult> {
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
}
