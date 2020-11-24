import { HttpClient } from "@angular/common/http";
import * as _ from "lodash";
import * as CircuitBreaker from "opossum";
import { from, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";
import { Addon } from "../entities/addon";
import { WowClientType } from "../models/warcraft/wow-client-type";
import { AddonDetailsResponse } from "../models/wow-interface/addon-details-response";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonFolder } from "../models/wowup/addon-folder";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";
import { ElectronService } from "../services";
import { CachingService } from "../services/caching/caching-service";
import { FileService } from "../services/files/file.service";
import { AddonProvider } from "./addon-provider";

const API_URL = "https://api.mmoui.com/v4/game/WOW";
const ADDON_URL = "https://www.wowinterface.com/downloads/info";

export class WowInterfaceAddonProvider implements AddonProvider {
  private readonly _circuitBreaker: CircuitBreaker<[addonId: string], AddonDetailsResponse>;

  public readonly name = "WowInterface";

  constructor(
    private _httpClient: HttpClient,
    private _cachingService: CachingService,
    private _electronService: ElectronService,
    private _fileService: FileService
  ) {
    this._circuitBreaker = new CircuitBreaker(this.getAddonDetails, {
      resetTimeout: 60000,
    });

    this._circuitBreaker.on("open", () => {
      console.log(`${this.name} circuit breaker open`);
    });
    this._circuitBreaker.on("close", () => {
      console.log(`${this.name} circuit breaker close`);
    });
  }

  async getAll(clientType: WowClientType, addonIds: string[]): Promise<AddonSearchResult[]> {
    var searchResults: AddonSearchResult[] = [];

    for (let addonId of addonIds) {
      var result = await this.getById(addonId, clientType).toPromise();
      if (result == null) {
        continue;
      }

      searchResults.push(result);
    }

    return searchResults;
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

    var addon = await this._circuitBreaker.fire(addonId);
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
    return from(this._circuitBreaker.fire(addonId)).pipe(
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

      const details = await this._circuitBreaker.fire(addonFolder.toc.wowInterfaceId);

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

  private getAddonDetails = (addonId: string): Promise<AddonDetailsResponse> => {
    console.debug("getAddonDetails");
    const url = new URL(`${API_URL}/filedetails/${addonId}.json`);

    return this._httpClient
      .get<AddonDetailsResponse[]>(url.toString())
      .pipe(map((responses) => _.first(responses)))
      .toPromise();
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
      installedVersion: addonFolder.toc?.version,
      isIgnored: false,
      latestVersion: response.version,
      name: response.title,
      providerName: this.name,
      thumbnailUrl: this.getThumbnailUrl(response),
      summary: response.description,
      screenshotUrls: response.images?.map((img) => img.imageUrl),
      downloadCount: response.downloads,
      releasedAt: new Date(response.lastUpdate),
    };
  }

  private toAddonSearchResult(response: AddonDetailsResponse, folderName?: string): AddonSearchResult {
    try {
      var searchResultFile: AddonSearchResultFile = {
        channelType: AddonChannelType.Stable,
        version: response.version,
        downloadUrl: response.downloadUri,
        folders: folderName ? [folderName] : [],
        gameVersion: "",
        releaseDate: new Date(response.lastUpdate),
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
        summary: response.description.substr(0, 100),
      };
    } catch (err) {
      console.error("Failed to create addon search result", err);
      return undefined;
    }
  }
}
