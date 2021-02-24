/* eslint-disable @typescript-eslint/no-unused-vars */
import { WowInstallation } from "app/models/wowup/wow-installation";
import { Observable, of } from "rxjs";

import { Addon } from "../../common/entities/addon";
import { WowClientType } from "../../common/warcraft/wow-client-type";
import { AddonChannelType } from "../../common/wowup/addon-channel-type";
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

  getAll(installation: WowInstallation, addonIds: string[]): Promise<GetAllResult> {
    return Promise.resolve({
      errors: [],
      searchResults: [],
    });
  }

  getFeaturedAddons(installation: WowInstallation, channelType?: AddonChannelType): Promise<AddonSearchResult[]> {
    return Promise.resolve([]);
  }

  searchByQuery(
    query: string,
    installation: WowInstallation,
    channelType?: AddonChannelType
  ): Promise<AddonSearchResult[]> {
    return Promise.resolve([]);
  }

  searchByUrl(addonUri: URL, installation: WowInstallation): Promise<AddonSearchResult | undefined> {
    return Promise.resolve(undefined);
  }

  searchByName(
    addonName: string,
    folderName: string,
    installation: WowInstallation,
    nameOverride?: string
  ): Promise<AddonSearchResult[]> {
    return Promise.resolve([]);
  }

  getById(addonId: string, installation: WowInstallation): Observable<AddonSearchResult> {
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
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {}

  getChangelog(installation: WowInstallation, externalId: string, externalReleaseId: string): Promise<string> {
    return Promise.resolve("");
  }

  async getDescription(installation: WowInstallation, externalId: string, addon?: Addon): Promise<string> {
    return Promise.resolve("");
  }
}
