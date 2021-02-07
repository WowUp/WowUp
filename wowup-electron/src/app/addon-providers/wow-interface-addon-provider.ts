import * as _ from "lodash";
import { from, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";

import { ADDON_PROVIDER_WOWINTERFACE } from "../../common/constants";
import { Addon } from "../entities/addon";
import { WowClientType } from "../models/warcraft/wow-client-type";
import { AddonDetailsResponse } from "../models/wow-interface/addon-details-response";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonFolder } from "../models/wowup/addon-folder";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";
import { CachingService } from "../services/caching/caching-service";
import { CircuitBreakerWrapper, NetworkService } from "../services/network/network.service";
import { convertBbcode } from "../utils/bbcode.utils";
import { AddonProvider, GetAllResult } from "./addon-provider";
import { getEnumName } from "../utils/enum.utils";

const API_URL = "https://api.mmoui.com/v4/game/WOW";
const ADDON_URL = "https://www.wowinterface.com/downloads/info";
const DETAILS_HTTP_CACHE_TTL_SEC = 5 * 60;

export class WowInterfaceAddonProvider extends AddonProvider {
  private readonly _circuitBreaker: CircuitBreakerWrapper;

  public readonly name = ADDON_PROVIDER_WOWINTERFACE;
  public readonly forceIgnore = false;
  public readonly allowReinstall = true;
  public readonly allowChannelChange = false;
  public readonly allowEdit = true;
  public enabled = true;

  constructor(private _cachingService: CachingService, private _networkService: NetworkService) {
    super();
    this._circuitBreaker = this._networkService.getCircuitBreaker(`${this.name}_main`);
  }

  public async getDescription(clientType: WowClientType, externalId: string, addon?: Addon): Promise<string> {
    const addonDetails = await this.getAddonDetails(externalId);
    return convertBbcode(addonDetails.description);
  }

  async getAll(clientType: WowClientType, addonIds: string[]): Promise<GetAllResult> {
    const searchResults: AddonSearchResult[] = [];

    for (let addonId of addonIds) {
      const result = await this.getById(addonId, clientType).toPromise();
      if (result == null) {
        continue;
      }

      searchResults.push(result);
    }

    return {
      errors: [],
      searchResults: searchResults,
    };
  }

  public async getChangelog(clientType: WowClientType, externalId: string, externalReleaseId: string): Promise<string> {
    const addon = await this.getAddonDetails(externalId);
    return addon.changeLog;
  }

  public async getFeaturedAddons(clientType: WowClientType): Promise<AddonSearchResult[]> {
    return [];
  }

  async searchByQuery(query: string, clientType: WowClientType): Promise<AddonSearchResult[]> {
    return [];
  }

  async searchByUrl(addonUri: URL, clientType: WowClientType): Promise<AddonSearchResult> {
    const addonId = this.getAddonId(addonUri);
    if (!addonId) {
      throw new Error(`Addon ID not found ${addonUri}`);
    }

    const addon = await this.getAddonDetails(addonId);
    if (addon == null) {
      throw new Error(`Bad addon api response ${addonUri}`);
    }

    return this.toAddonSearchResult(addon);
  }

  searchByName(
    addonName: string,
    folderName: string,
    clientType: WowClientType,
    nameOverride?: string
  ): Promise<AddonSearchResult[]> {
    throw new Error("Method not implemented.");
  }

  public getById(addonId: string, clientType: WowClientType): Observable<AddonSearchResult> {
    return from(this.getAddonDetails(addonId)).pipe(
      map((result) => (result ? this.toAddonSearchResult(result, "") : undefined))
    );
  }

  public isValidAddonUri(addonUri: URL): boolean {
    return addonUri.host && addonUri.host.endsWith("wowinterface.com");
  }

  public isValidAddonId(addonId: string): boolean {
    return !!addonId && !isNaN(parseInt(addonId, 10));
  }

  public onPostInstall(addon: Addon): void {
    throw new Error("Method not implemented.");
  }

  async scan(
    clientType: WowClientType,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {
    for (let addonFolder of addonFolders) {
      if (!addonFolder?.toc?.wowInterfaceId) {
        continue;
      }

      const details = await this.getAddonDetails(addonFolder.toc.wowInterfaceId);

      addonFolder.matchingAddon = this.toAddon(details, clientType, addonChannelType, addonFolder);
    }
  }

  //https://www.wowinterface.com/downloads/download25538-Aardvark
  private getAddonId(addonUri: URL): string {
    const downloadUrlregex = /\/download(\d+)/i;
    const downloadUrlMatch = downloadUrlregex.exec(addonUri.pathname);
    if (downloadUrlMatch) {
      return downloadUrlMatch[1];
    }

    const infoUrlRegex = /\/info(\d+)/i;
    const infoUrlMatch = infoUrlRegex.exec(addonUri.pathname);
    if (infoUrlMatch) {
      return infoUrlMatch[1];
    }

    throw new Error(`Unhandled URL: ${addonUri}`);
  }

  private getAddonDetails = async (addonId: string): Promise<AddonDetailsResponse> => {
    const url = new URL(`${API_URL}/filedetails/${addonId}.json`);

    const responses = await this._cachingService.transaction(
      url.toString(),
      () => this._circuitBreaker.getJson<AddonDetailsResponse[]>(url),
      DETAILS_HTTP_CACHE_TTL_SEC
    );

    return _.first(responses);
  };

  private getThumbnailUrl(response: AddonDetailsResponse) {
    return _.first(response.images)?.thumbUrl;
  }

  private getAddonUrl(response: AddonDetailsResponse) {
    return `${ADDON_URL}${response.id}`;
  }

  private toAddon(
    response: AddonDetailsResponse,
    clientType: WowClientType,
    addonChannelType: AddonChannelType,
    addonFolder: AddonFolder
  ): Addon {
    return {
      id: uuidv4(),
      author: response.author,
      autoUpdateEnabled: false,
      channelType: addonChannelType,
      clientType: clientType,
      downloadUrl: response.downloadUri,
      externalId: response.id.toString(),
      externalUrl: this.getAddonUrl(response),
      gameVersion: addonFolder.toc.interface,
      installedAt: new Date(),
      installedFolders: addonFolder.name,
      installedFolderList: [addonFolder.name],
      installedVersion: addonFolder.toc?.version,
      isIgnored: false,
      latestVersion: response.version,
      name: response.title,
      providerName: this.name,
      thumbnailUrl: this.getThumbnailUrl(response),
      summary: convertBbcode(response.description),
      screenshotUrls: response.images?.map((img) => img.imageUrl),
      downloadCount: response.downloads,
      releasedAt: new Date(response.lastUpdate),
      isLoadOnDemand: false,
      latestChangelog: convertBbcode(response.changeLog),
      externalChannel: getEnumName(AddonChannelType, AddonChannelType.Stable),
    };
  }

  private toAddonSearchResult(response: AddonDetailsResponse, folderName?: string): AddonSearchResult {
    try {
      const searchResultFile: AddonSearchResultFile = {
        channelType: AddonChannelType.Stable,
        version: response.version,
        downloadUrl: response.downloadUri,
        folders: folderName ? [folderName] : [],
        gameVersion: "",
        releaseDate: new Date(response.lastUpdate),
        changelog: convertBbcode(response.changeLog),
      };

      return {
        author: response.author,
        externalId: response.id.toString(),
        name: response.title,
        thumbnailUrl: this.getThumbnailUrl(response),
        externalUrl: this.getAddonUrl(response),
        providerName: this.name,
        downloadCount: response.downloads,
        files: [searchResultFile],
        summary: convertBbcode(response.description),
      };
    } catch (err) {
      console.error("Failed to create addon search result", err);
      return undefined;
    }
  }
}
