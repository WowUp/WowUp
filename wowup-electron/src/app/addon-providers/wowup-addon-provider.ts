import * as _ from "lodash";
import { from, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";

import { ADDON_PROVIDER_HUB, WOWUP_GET_SCAN_RESULTS } from "../../common/constants";
import { WowUpScanResult } from "../../common/wowup/wowup-scan-result";
import { AppConfig } from "../../environments/environment";
import { Addon } from "../entities/addon";
import { WowClientType } from "../models/warcraft/wow-client-type";
import { WowUpAddonReleaseRepresentation, WowUpAddonRepresentation } from "../models/wowup-api/addon-representations";
import {
  WowUpGetAddonReleaseResponse,
  WowUpGetAddonResponse,
  WowUpGetAddonsResponse,
  WowUpSearchAddonsResponse,
} from "../models/wowup-api/api-responses";
import { GetAddonsByFingerprintResponse } from "../models/wowup-api/get-addons-by-fingerprint.response";
import { WowGameType } from "../models/wowup-api/wow-game-type";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonFolder } from "../models/wowup/addon-folder";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";
import { AppWowUpScanResult } from "../models/wowup/app-wowup-scan-result";
import { ElectronService } from "../services";
import { CachingService } from "../services/caching/caching-service";
import { CircuitBreakerWrapper, NetworkService } from "../services/network/network.service";
import { getGameVersion } from "../utils/addon.utils";
import { getEnumName } from "../utils/enum.utils";
import { AddonProvider } from "./addon-provider";

const API_URL = AppConfig.wowUpHubUrl;
const CHANGELOG_CACHE_TTL_SEC = 30 * 60;

export interface GetAddonBatchResponse {
  addons: WowUpAddonRepresentation[];
}

export class WowUpAddonProvider extends AddonProvider {
  private readonly _circuitBreaker: CircuitBreakerWrapper;

  public readonly name = ADDON_PROVIDER_HUB;
  public readonly forceIgnore = false;
  public readonly allowReinstall = true;
  public readonly allowChannelChange = true;
  public readonly allowEdit = true;
  public enabled = true;

  constructor(
    private _electronService: ElectronService,
    private _networkService: NetworkService,
    private _cachingService: CachingService
  ) {
    super();

    this._circuitBreaker = _networkService.getCircuitBreaker(
      `${this.name}_main`,
      AppConfig.defaultHttpResetTimeoutMs,
      AppConfig.wowUpHubHttpTimeoutMs
    );
  }

  public async getDescription(clientType: WowClientType, externalId: string): Promise<string> {
    try {
      const cacheKey = `${this.name}_description_${externalId}`;
      return await this._cachingService.transaction(
        cacheKey,
        async () => {
          const response = await this.getAddonById(externalId);
          return response.addon?.description;
        },
        CHANGELOG_CACHE_TTL_SEC
      );
    } catch (e) {
      console.error("Failed to get changelog", e);
    }
    return "";
  }

  async getAll(clientType: WowClientType, addonIds: string[]): Promise<AddonSearchResult[]> {
    const gameType = this.getWowGameType(clientType);
    const url = new URL(`${API_URL}/addons/batch/${gameType}`);
    const addonIdList = _.map(addonIds, (id) => parseInt(id, 10));

    const response = await this._circuitBreaker.postJson<GetAddonBatchResponse>(url, {
      addonIds: addonIdList,
    });

    const searchResults = _.map(response?.addons, (addon) => this.getSearchResult(addon));
    return searchResults;
  }

  public async getFeaturedAddons(clientType: WowClientType): Promise<AddonSearchResult[]> {
    const gameType = this.getWowGameType(clientType);
    const url = new URL(`${API_URL}/addons/featured/${gameType}?count=30`);
    const addons = await this._circuitBreaker.getJson<WowUpGetAddonsResponse>(url);

    const searchResults = _.map(addons?.addons, (addon) => this.getSearchResult(addon));
    return searchResults;
  }

  async searchByQuery(query: string, clientType: WowClientType): Promise<AddonSearchResult[]> {
    const gameType = this.getWowGameType(clientType);
    const url = new URL(`${API_URL}/addons/search/${gameType}?query=${query}&limit=10`);

    const addons = await this._circuitBreaker.getJson<WowUpSearchAddonsResponse>(url);
    const searchResults = _.map(addons?.addons, (addon) => this.getSearchResult(addon));

    return searchResults;
  }

  async searchByUrl(addonUri: URL, clientType: WowClientType): Promise<AddonSearchResult> {
    // TODO
    return undefined;
  }

  async searchByName(
    addonName: string,
    folderName: string,
    clientType: WowClientType,
    nameOverride?: string
  ): Promise<AddonSearchResult[]> {
    // TODO
    return [];
  }

  getById(addonId: string, clientType: WowClientType): Observable<AddonSearchResult> {
    const url = new URL(`${API_URL}/addons/${addonId}`);
    return from(this._circuitBreaker.getJson<WowUpGetAddonResponse>(url)).pipe(
      map((result) => {
        console.debug("Result", result);
        return this.getSearchResult(result.addon);
      })
    );
  }

  getReleaseById(addonId: string, releaseId: string): Observable<WowUpGetAddonReleaseResponse> {
    const url = new URL(`${API_URL}/addons/${addonId}/releases/${releaseId}`);
    return from(this._circuitBreaker.getJson<WowUpGetAddonReleaseResponse>(url));
  }

  isValidAddonUri(addonUri: URL): boolean {
    // TODO
    return false;
  }

  isValidAddonId(addonId: string): boolean {
    return true;
  }

  onPostInstall(addon: Addon): void {
    throw new Error("Method not implemented.");
  }

  async scan(clientType: WowClientType, addonChannelType: any, addonFolders: AddonFolder[]): Promise<void> {
    console.debug("WowUp scan start");
    console.time("WowUpScan");
    const scanResults = await this.getScanResults(addonFolders);
    console.timeEnd("WowUpScan");

    console.debug("ScanResults", scanResults.length);
    const fingerprints = scanResults.map((result) => result.fingerprint);
    console.log("fingerprintRequest", JSON.stringify(fingerprints));
    const fingerprintResponse = await this.getAddonsByFingerprints(fingerprints);

    console.debug("fingerprintResponse", fingerprintResponse);

    for (let scanResult of scanResults) {
      // Wowup can deliver the wrong result sometimes, ensure the result matches the client type
      scanResult.exactMatch = fingerprintResponse.exactMatches.find(
        (exactMatch) =>
          this.isGameType(exactMatch.matched_release, clientType) &&
          this.hasMatchingFingerprint(scanResult, exactMatch.matched_release)
      );
    }

    for (let addonFolder of addonFolders) {
      var scanResult = scanResults.find((sr) => sr.path === addonFolder.path);
      if (!scanResult.exactMatch) {
        continue;
      }

      try {
        const newAddon = this.getAddon(clientType, addonChannelType, scanResult);

        addonFolder.matchingAddon = newAddon;
      } catch (err) {
        console.error(scanResult);
        console.error(err);
      }
    }
  }

  public async getChangelog(clientType: WowClientType, externalId: string, externalReleaseId: string): Promise<string> {
    console.debug("GET CHANGELOG");
    const addon = await this.getReleaseById(externalId, externalReleaseId).toPromise();
    return addon?.release?.body ?? "";
  }

  public getScanResults = async (addonFolders: AddonFolder[]): Promise<AppWowUpScanResult[]> => {
    const filePaths = addonFolders.map((addonFolder) => addonFolder.path);

    const scanResults: AppWowUpScanResult[] = await this._electronService.invoke(WOWUP_GET_SCAN_RESULTS, filePaths);

    console.debug("WowUpGetScanResultsResponse", scanResults);

    return scanResults;
  };

  private async getAddonById(addonId: number | string) {
    const url = new URL(`${API_URL}/addons/${addonId}`);
    return await this._circuitBreaker.getJson<WowUpGetAddonResponse>(url);
  }

  private hasMatchingFingerprint(scanResult: WowUpScanResult, release: WowUpAddonReleaseRepresentation) {
    return release.addonFolders.some((addonFolder) => addonFolder.fingerprint == scanResult.fingerprint);
  }

  private isGameType(release: WowUpAddonReleaseRepresentation, clientType: WowClientType) {
    return release.game_type === this.getWowGameType(clientType);
  }

  private getAddonsByFingerprints(fingerprints: string[]): Promise<GetAddonsByFingerprintResponse> {
    const url = `${API_URL}/addons/fingerprint`;

    return this._circuitBreaker.postJson<any>(url, {
      fingerprints,
    });
  }

  private getAddonReleaseChannel(file: WowUpAddonReleaseRepresentation) {
    return file.prerelease ? AddonChannelType.Beta : AddonChannelType.Stable;
  }

  private getSearchResultFile(file: WowUpAddonReleaseRepresentation): AddonSearchResultFile {
    return {
      channelType: this.getAddonReleaseChannel(file),
      downloadUrl: file.download_url,
      folders: [],
      gameVersion: getGameVersion(file.game_version),
      releaseDate: file.published_at,
      version: file.tag_name,
      dependencies: [],
      changelog: file.body,
      externalId: file.id.toString(),
    };
  }

  private getSearchResult(representation: WowUpAddonRepresentation): AddonSearchResult {
    const searchResultFiles: AddonSearchResultFile[] = _.map(representation.releases, (release) =>
      this.getSearchResultFile(release)
    );

    return {
      author: representation.owner_name,
      externalId: representation.id.toString(),
      externalUrl: representation.repository,
      name: representation.repository_name,
      providerName: this.name,
      thumbnailUrl: representation.image_url || representation.owner_image_url,
      downloadCount: representation.total_download_count,
      files: searchResultFiles,
      releasedAt: new Date(),
      screenshotUrl: "",
      screenshotUrls: [],
      summary: representation.description,
      fundingLinks: [...representation.funding_links],
    };
  }

  private getAddon(
    clientType: WowClientType,
    addonChannelType: AddonChannelType,
    scanResult: AppWowUpScanResult
  ): Addon {
    const authors = scanResult.exactMatch.owner_name;
    const folders = scanResult.exactMatch.matched_release.addonFolders.map((af) => af.folder_name);
    const folderList = folders.join(", ");

    let channelType = addonChannelType;

    return {
      id: uuidv4(),
      author: authors,
      name: scanResult.exactMatch.repository_name,
      channelType,
      autoUpdateEnabled: false,
      clientType,
      downloadUrl: scanResult.exactMatch.matched_release.download_url,
      externalUrl: scanResult.exactMatch.repository,
      externalId: scanResult.exactMatch.id.toString(),
      gameVersion: scanResult.exactMatch.matched_release.game_version,
      installedAt: new Date(),
      installedFolders: folderList,
      installedFolderList: folders,
      installedVersion: scanResult.exactMatch.matched_release.tag_name,
      installedExternalReleaseId: scanResult.exactMatch.matched_release.id.toString(),
      isIgnored: false,
      latestVersion: scanResult.exactMatch.matched_release.tag_name,
      providerName: this.name,
      providerSource: scanResult.exactMatch.source,
      thumbnailUrl: scanResult.exactMatch.image_url,
      fundingLinks: [...scanResult.exactMatch.funding_links],
      isLoadOnDemand: false,
      releasedAt: scanResult.exactMatch?.matched_release?.published_at,
      externalChannel: getEnumName(AddonChannelType, channelType),
      latestChangelog: scanResult.exactMatch?.matched_release?.body,
      externalLatestReleaseId: scanResult?.exactMatch?.matched_release?.id?.toString(),
    };
  }

  private getWowGameType(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Classic:
      case WowClientType.ClassicPtr:
        return WowGameType.Classic;
      case WowClientType.Retail:
      case WowClientType.RetailPtr:
      case WowClientType.Beta:
      default:
        return WowGameType.Retail;
    }
  }
}
