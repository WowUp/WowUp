import * as _ from "lodash";
import { Observable } from "rxjs";
import { v4 as uuidv4 } from "uuid";

import { ADDON_PROVIDER_RAIDERIO } from "../../common/constants";
import { Addon } from "../entities/addon";
import { WowClientType } from "../models/warcraft/wow-client-type";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonFolder } from "../models/wowup/addon-folder";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { getEnumName } from "../utils/enum.utils";
import { AddonProvider } from "./addon-provider";

export class RaiderIoAddonProvider implements AddonProvider {
  private readonly _scanWebsite = "https://raider.io";
  private readonly _scanAddonProvider = "raiderio-client";
  private readonly _scanFolderName = "RaiderIO";

  public readonly name = ADDON_PROVIDER_RAIDERIO;
  public readonly forceIgnore = true;
  public readonly allowReinstall = false;
  public readonly allowChannelChange = false;
  public readonly allowEdit = false;
  public enabled = true;

  constructor() {}

  public async getChangelog(clientType: WowClientType, externalId: string, externalReleaseId: string): Promise<string> {
    return "";
  }

  public async getAll(clientType: WowClientType, addonIds: string[]): Promise<AddonSearchResult[]> {
    return [];
  }

  public async getFeaturedAddons(clientType: WowClientType): Promise<AddonSearchResult[]> {
    return [];
  }

  public async searchByQuery(query: string, clientType: WowClientType): Promise<AddonSearchResult[]> {
    return [];
  }

  public async searchByUrl(addonUri: URL, clientType: WowClientType): Promise<AddonSearchResult> {
    return undefined;
  }

  public async searchByName(
    addonName: string,
    folderName: string,
    clientType: WowClientType,
    nameOverride?: string
  ): Promise<AddonSearchResult[]> {
    return [];
  }

  public getById(addonId: string, clientType: WowClientType): Observable<AddonSearchResult> {
    return undefined;
  }

  public isValidAddonUri(addonUri: URL): boolean {
    return false;
  }

  public isValidAddonId(addonId: string): boolean {
    return false;
  }

  public onPostInstall(addon: Addon): void {}

  public async scan(
    clientType: WowClientType,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {
    console.debug("RAIDER IO CLIENT SCAN");
    const raiderIo = _.find(addonFolders, (addonFolder) => this.isRaiderIo(addonFolder));
    if (!raiderIo) {
      return;
    }

    const dependencies = _.filter(addonFolders, (addonFolder) => this.isRaiderIoDependant(addonFolder));
    console.debug("RAIDER IO CLIENT FOUND", dependencies);

    const rioAddonFolders = [raiderIo, ...dependencies];
    const installedFolders = rioAddonFolders.map((addonFolder) => addonFolder.name).join(",");

    for (const rioAddonFolder of rioAddonFolders) {
      rioAddonFolder.matchingAddon = {
        autoUpdateEnabled: false,
        channelType: AddonChannelType.Stable,
        clientType,
        id: uuidv4(),
        isIgnored: true,
        name: raiderIo.toc.title,
        author: rioAddonFolder.toc.author,
        downloadUrl: "",
        externalId: this.name,
        externalUrl: this._scanWebsite,
        gameVersion: rioAddonFolder.toc.interface,
        installedAt: new Date(),
        installedFolders: installedFolders,
        installedVersion: rioAddonFolder.toc.version || raiderIo.toc.version,
        latestVersion: raiderIo.toc.version,
        providerName: this.name,
        thumbnailUrl: "http://cdnassets.raider.io/images/fb_app_image.jpg?2019-11-18",
        updatedAt: new Date(),
        summary: rioAddonFolder.toc.notes,
        downloadCount: 0,
        screenshotUrls: [],
        releasedAt: new Date(),
        isLoadOnDemand: rioAddonFolder.toc.loadOnDemand === "1",
        externalChannel: getEnumName(AddonChannelType, AddonChannelType.Stable),
      };
    }
  }

  private isRaiderIo(addonFolder: AddonFolder) {
    return (
      addonFolder.name === this._scanFolderName &&
      addonFolder.toc?.website === this._scanWebsite &&
      addonFolder.toc?.addonProvider === this._scanAddonProvider
    );
  }

  private isRaiderIoDependant(addonFolder: AddonFolder) {
    return addonFolder.toc?.dependencies.indexOf(this._scanFolderName) !== -1;
  }
}
