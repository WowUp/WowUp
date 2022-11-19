import * as _ from "lodash";
import { v4 as uuidv4 } from "uuid";

import { HttpErrorResponse } from "@angular/common/http";

import { ADDON_PROVIDER_WOWINTERFACE } from "../../common/constants";
import { SourceRemovedAddonError } from "../errors";
import { AddonDetailsResponse } from "../models/wow-interface/addon-details-response";
import { CachingService } from "../services/caching/caching-service";
import { CircuitBreakerWrapper, NetworkService } from "../services/network/network.service";
import { getGameVersion } from "../utils/addon.utils";
import { convertBbcode } from "../utils/bbcode.utils";
import { getEnumName } from "wowup-lib-core/lib/utils";
import { strictFilter } from "../utils/array.utils";
import { TocService } from "../services/toc/toc.service";
import {
  Addon,
  AddonChannelType,
  AddonFolder,
  AddonProvider,
  AddonSearchResult,
  AddonSearchResultFile,
  GetAllResult,
  SearchByUrlResult,
  WowInstallation,
} from "wowup-lib-core";

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

  public constructor(
    private _cachingService: CachingService,
    private _networkService: NetworkService,
    private _tocService: TocService
  ) {
    super();
    this._circuitBreaker = this._networkService.getCircuitBreaker(`${this.name}_main`);
  }

  public async getDescription(installation: WowInstallation, externalId: string): Promise<string> {
    try {
      const addonDetails = await this.getAddonDetails(externalId);
      return convertBbcode(addonDetails?.description ?? "");
    } catch (error) {
      console.error(error);
      return "";
    }
  }

  public async getAll(installation: WowInstallation, addonIds: string[]): Promise<GetAllResult> {
    const errors: Error[] = [];
    const searchResults = await this.getAllById(addonIds);

    for (const addonId of addonIds) {
      try {
        const result = searchResults.find((sr) => sr.externalId === addonId);
        if (result == null) {
          continue;
        }

        searchResults.push(result);
      } catch (error) {
        console.error(error);
        // Check if the addon 404d which means its deleted or missing.
        if (error instanceof HttpErrorResponse && error.status === 404) {
          errors.push(new SourceRemovedAddonError(addonId, error));
        } else {
          error.addonId = addonId;
          errors.push(error as Error);
        }
      }
    }

    return {
      errors,
      searchResults,
    };
  }

  public async getChangelog(installation: WowInstallation, externalId: string): Promise<string> {
    try {
      const addon = await this.getAddonDetails(externalId);
      return convertBbcode(addon?.changeLog ?? "");
    } catch (error) {
      console.error(`Failed to get addon changelog`, error);
      return "";
    }
  }

  public async searchByUrl(addonUri: URL): Promise<SearchByUrlResult> {
    const addonId = this.getAddonId(addonUri);
    if (!addonId) {
      throw new Error(`Addon ID not found ${addonUri.toString()}`);
    }

    const addon = await this.getAddonDetails(addonId);
    if (addon == null) {
      throw new Error(`Bad addon api response ${addonUri.toString()}`);
    }

    const searchResult = this.toAddonSearchResult(addon);
    if (searchResult == null) {
      throw new Error(`Failed to create search result  ${addonUri.toString()}`);
    }

    return {
      errors: [],
      searchResult,
    };
  }

  public override async getById(addonId: string): Promise<AddonSearchResult | undefined> {
    const result = await this.getAddonDetails(addonId);
    if (result !== undefined) {
      return this.toAddonSearchResult(result, "");
    }
  }

  public async getAllById(addonIds: string[]): Promise<AddonSearchResult[]> {
    const addonDetails = await this.getAllAddonDetails(addonIds);
    const mapped = addonDetails.map((ad) => this.toAddonSearchResult(ad, ""));
    const filtered = strictFilter(mapped);
    return filtered;
  }

  public isValidAddonUri(addonUri: URL): boolean {
    return !!addonUri.host && addonUri.host.endsWith("wowinterface.com");
  }

  public isValidAddonId(addonId: string): boolean {
    return !!addonId && !isNaN(parseInt(addonId, 10));
  }

  public override async scan(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {
    const wowiFolders = addonFolders.filter((folder) =>
      folder.tocs.some((toc) => !!toc.wowInterfaceId && toc.loadOnDemand !== "1")
    );
    const addonIds = _.uniq(_.flatten(wowiFolders.map((folder) => folder.tocs.map((toc) => toc.wowInterfaceId))));

    const addonDetails = await this.getAllAddonDetails(addonIds);

    for (const addonFolder of wowiFolders) {
      const targetToc = this._tocService.getTocForGameType2(addonFolder, installation.clientType);
      if (!targetToc?.wowInterfaceId) {
        continue;
      }

      const details = addonDetails.find((ad) => ad.id.toString() === targetToc.wowInterfaceId);
      if (!details) {
        console.warn("Details not found");
        continue;
      }

      addonFolder.matchingAddon = this.toAddon(details, installation, addonChannelType, addonFolder);
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

    throw new Error(`Unhandled URL: ${addonUri.toString()}`);
  }

  private getAddonDetails = async (addonId: string): Promise<AddonDetailsResponse | undefined> => {
    const url = new URL(`${API_URL}/filedetails/${addonId}.json`);

    const responses = await this._cachingService.transaction(
      url.toString(),
      () => this._circuitBreaker.getJson<AddonDetailsResponse[]>(url),
      DETAILS_HTTP_CACHE_TTL_SEC
    );

    return _.first(responses);
  };

  private getAllAddonDetails = async (addonIds: string[]): Promise<AddonDetailsResponse[]> => {
    if (addonIds.length === 0) {
      return [];
    }

    const url = new URL(`${API_URL}/filedetails/${addonIds.join(",")}.json`);

    const responses = await this._cachingService.transaction(
      url.toString(),
      () => this._circuitBreaker.getJson<AddonDetailsResponse[]>(url),
      DETAILS_HTTP_CACHE_TTL_SEC
    );

    return responses;
  };

  private getThumbnailUrl(response: AddonDetailsResponse): string {
    return _.first(response.images)?.thumbUrl ?? "";
  }

  private getAddonUrl(response: AddonDetailsResponse) {
    return `${ADDON_URL}${response.id}`;
  }

  private toAddon(
    response: AddonDetailsResponse,
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolder: AddonFolder
  ): Addon {
    const targetToc = this._tocService.getTocForGameType2(addonFolder, installation.clientType);

    return {
      id: uuidv4(),
      author: response.author,
      autoUpdateEnabled: false,
      autoUpdateNotificationsEnabled: false,
      channelType: addonChannelType,
      clientType: installation.clientType,
      downloadUrl: response.downloadUri,
      externalId: response.id.toString(),
      externalUrl: this.getAddonUrl(response),
      gameVersion: getGameVersion(targetToc.interface),
      installedAt: new Date(),
      installedFolders: addonFolder.name,
      installedFolderList: [addonFolder.name],
      installedVersion: targetToc?.version,
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
      installationId: installation.id,
    };
  }

  private toAddonSearchResult(response: AddonDetailsResponse, folderName?: string): AddonSearchResult | undefined {
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
