import * as _ from "lodash";
import { from, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";

import { ADDON_PROVIDER_HUB, APP_PROTOCOL_NAME, IPC_WOWUP_GET_SCAN_RESULTS } from "../../common/constants";
import { Addon } from "../../common/entities/addon";
import { WowClientGroup, WowClientType } from "../../common/warcraft/wow-client-type";
import { AddonCategory, AddonChannelType, WowUpScanResult } from "../../common/wowup/models";
import { AppConfig } from "../../environments/environment";
import { SourceRemovedAddonError } from "../errors";
import {
  AddonReleaseGameVersion,
  WowUpAddonReleaseRepresentation,
  WowUpAddonRepresentation,
} from "../models/wowup-api/addon-representations";
import {
  GetFeaturedAddonsResponse,
  WowUpGetAddonReleaseResponse,
  WowUpGetAddonResponse,
  WowUpGetAddonsResponse,
  WowUpSearchAddonsResponse,
} from "../models/wowup-api/api-responses";
import { GetAddonsByFingerprintResponse } from "../models/wowup-api/get-addons-by-fingerprint.response";
import { WowGameType } from "../models/wowup-api/wow-game-type";
import { AddonFolder } from "../models/wowup/addon-folder";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";
import { AppWowUpScanResult } from "../models/wowup/app-wowup-scan-result";
import { WowInstallation } from "../../common/warcraft/wow-installation";
import { ElectronService } from "../services";
import { CachingService } from "../services/caching/caching-service";
import { CircuitBreakerWrapper, NetworkService } from "../services/network/network.service";
import { getGameVersion } from "../utils/addon.utils";
import { getEnumName } from "../utils/enum.utils";
import { AddonProvider, GetAllBatchResult, GetAllResult } from "./addon-provider";
import { ProtocolSearchResult } from "../models/wowup/protocol-search-result";

interface ProtocolData {
  addonId: string;
  releaseId: string;
}

const API_URL = AppConfig.wowUpHubUrl;
const FEATURED_ADDONS_CACHE_TTL_SEC = AppConfig.featuredAddonsCacheTimeSec;
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
  public readonly canBatchFetch = true;
  public enabled = true;

  public constructor(
    private _electronService: ElectronService,
    private _cachingService: CachingService,
    _networkService: NetworkService
  ) {
    super();

    this._circuitBreaker = _networkService.getCircuitBreaker(
      `${this.name}_main`,
      AppConfig.defaultHttpResetTimeoutMs,
      AppConfig.wowUpHubHttpTimeoutMs
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async getDescription(installation: WowInstallation, externalId: string, addon?: Addon): Promise<string> {
    try {
      const response = await this.getAddonById(externalId);
      return response.addon?.description ?? "";
    } catch (e) {
      console.error("Failed to get description", e);
    }
    return "";
  }

  public shouldMigrate(addon: Addon): boolean {
    return !addon.installedExternalReleaseId;
  }

  public isValidProtocol(protocol: string): boolean {
    return protocol.toLowerCase().startsWith(`${APP_PROTOCOL_NAME}://`);
  }

  public async searchProtocol(protocol: string): Promise<ProtocolSearchResult | undefined> {
    const protocolData = this.parseProtocol(protocol);
    if (!protocolData.addonId || !protocolData.releaseId) {
      throw new Error("Invalid protocol data");
    }

    const addonResult = await this.getAddonById(protocolData.addonId);
    if (!addonResult) {
      throw new Error(`Failed to get addon data: ${protocolData.addonId}`);
    }

    console.debug("addonResult", addonResult);

    const addonFileResponse = await this.getReleaseById(protocolData.addonId, protocolData.releaseId);
    console.debug("targetFile", addonFileResponse);

    if (!addonFileResponse) {
      throw new Error("Failed to get target file");
    }

    const addonSearchResult = this.getSearchResultWithReleases(addonResult.addon, [addonFileResponse.release]);
    if (!addonSearchResult) {
      throw new Error("Addon search result not created");
    }

    const searchResult: ProtocolSearchResult = {
      protocol,
      protocolAddonId: protocolData.addonId.toString(),
      protocolReleaseId: protocolData.releaseId.toString(),
      validClientGroups: _.map(addonFileResponse.release.game_versions, (gv) => this.getWowClientGroup(gv.game_type)),
      ...addonSearchResult,
    };

    console.debug("searchResult", searchResult);
    return searchResult;
  }

  private parseProtocol(protocol: string): ProtocolData {
    const url = new URL(protocol);
    return {
      addonId: url.searchParams.get("addonId") || "",
      releaseId: url.searchParams.get("releaseId") || "",
    };
  }

  public async getAllBatch(installations: WowInstallation[], addonIds: string[]): Promise<GetAllBatchResult> {
    const batchResult: GetAllBatchResult = {
      errors: {},
      installationResults: {},
    };

    if (!addonIds.length) {
      return batchResult;
    }

    const url = new URL(`${API_URL}/addons/batch`);
    const addonIdList = _.map(addonIds, (id) => parseInt(id, 10));
    const response = await this._circuitBreaker.postJson<GetAddonBatchResponse>(url, {
      addonIds: addonIdList,
    });

    for (const installation of installations) {
      const addonResults: AddonSearchResult[] = [];
      const gameType = this.getWowGameType(installation.clientType);

      for (const result of response.addons) {
        const latestFiles = this.getLatestFiles(result, gameType);
        if (!latestFiles.length) {
          continue;
        }

        const searchResult = this.getSearchResult(result, gameType);
        if (searchResult) {
          addonResults.push(searchResult);
        }
      }

      const missingAddonIds = _.filter(
        addonIds,
        (addonId) => _.find(addonResults, (sr) => sr.externalId === addonId) === undefined
      );

      batchResult.errors[installation.id] = _.map(
        missingAddonIds,
        (addonId) => new SourceRemovedAddonError(addonId, undefined)
      );

      batchResult.installationResults[installation.id] = addonResults;
    }

    return batchResult;
  }

  private getLatestFiles(result: WowUpAddonRepresentation, gameType: WowGameType): WowUpAddonReleaseRepresentation[] {
    const filtered = result.releases.filter((latestFile) => !!this.getMatchingVersion(latestFile, gameType));
    return _.sortBy(filtered, (latestFile) => latestFile.id).reverse();
  }

  public async getAll(installation: WowInstallation, addonIds: string[]): Promise<GetAllResult> {
    const gameType = this.getWowGameType(installation.clientType);
    const url = new URL(`${API_URL}/addons/batch/${gameType}`);
    const addonIdList = _.map(addonIds, (id) => parseInt(id, 10));

    const response = await this._circuitBreaker.postJson<GetAddonBatchResponse>(url, {
      addonIds: addonIdList,
    });

    const searchResults = _.map(response?.addons, (addon) => this.getSearchResult(addon, gameType)).filter(
      (sr) => sr !== undefined
    );

    const missingAddonIds = _.filter(
      addonIds,
      (addonId) => _.find(searchResults, (sr) => sr.externalId === addonId) === undefined
    );

    const deletedErrors = _.map(missingAddonIds, (addonId) => new SourceRemovedAddonError(addonId, undefined));

    return {
      errors: [...deletedErrors],
      searchResults,
    };
  }

  public async getFeaturedAddons(installation: WowInstallation): Promise<AddonSearchResult[]> {
    const gameType = this.getWowGameType(installation.clientType);
    const url = new URL(`${API_URL}/addons/featured/${gameType}`);
    url.searchParams.set("count", "60");
    url.searchParams.set("recent", "30");

    const response = await this._cachingService.transaction(
      url.toString(),
      () => this._circuitBreaker.getJson<GetFeaturedAddonsResponse>(url),
      FEATURED_ADDONS_CACHE_TTL_SEC
    );

    // Remove duplicate addons that are already in the popular list from the recents list
    const uniqueRecent = (response.recent ?? []).filter((ru) => !response.addons.some((p) => p.id === ru.id));
    const addonResults = [...response.addons, ...uniqueRecent];

    const searchResults = _.map(addonResults, (addon) => this.getSearchResult(addon, gameType)).filter(
      (sr) => sr !== undefined
    );
    return searchResults;
  }

  public async searchByQuery(query: string, installation: WowInstallation): Promise<AddonSearchResult[]> {
    const gameType = this.getWowGameType(installation.clientType);
    const url = new URL(`${API_URL}/addons/search/${gameType}?query=${query}&limit=10`);

    const addons = await this._cachingService.transaction(
      url.toString(),
      () => this._circuitBreaker.getJson<WowUpSearchAddonsResponse>(url),
      5
    );
    const searchResults = _.map(addons?.addons, (addon) => this.getSearchResult(addon, gameType)).filter(
      (sr) => sr !== undefined
    );

    return searchResults;
  }

  public isValidAddonUri(): boolean {
    // TODO
    return false;
  }

  public isValidAddonId(addonId: string): boolean {
    const idNumber = parseInt(addonId, 10);
    return !isNaN(idNumber) && isFinite(idNumber) && idNumber > 0;
  }

  public getById(addonId: string, installation: WowInstallation): Observable<AddonSearchResult> {
    const gameType = this.getWowGameType(installation.clientType);
    const url = new URL(`${API_URL}/addons/${addonId}`);
    const task = this._cachingService.transaction(
      url.toString(),
      () => this._circuitBreaker.getJson<WowUpGetAddonResponse>(url),
      CHANGELOG_CACHE_TTL_SEC
    );

    return from(task).pipe(
      map((result) => {
        return this.getSearchResult(result.addon, gameType);
      })
    );
  }

  public async getReleaseById(addonId: string, releaseId: string): Promise<WowUpGetAddonReleaseResponse> {
    const url = new URL(`${API_URL}/addons/${addonId}/releases/${releaseId}`);
    return await this._cachingService.transaction(
      url.toString(),
      async () => this._circuitBreaker.getJson<WowUpGetAddonReleaseResponse>(url),
      CHANGELOG_CACHE_TTL_SEC
    );
  }

  public async getCategory(category: AddonCategory, installation: WowInstallation): Promise<AddonSearchResult[]> {
    const gameType = this.getWowGameType(installation.clientType);
    const response = await this.getAddonsByCategory(gameType, category);

    const searchResults = _.map(response?.addons, (addon) => this.getSearchResult(addon, gameType)).filter(
      (sr) => sr !== undefined
    );

    return searchResults;
  }

  public async scan(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {
    const gameType = this.getWowGameType(installation.clientType);

    const scanResults = addonFolders.map((af) => af.wowUpScanResults).filter((sr) => sr !== undefined);

    const fingerprints = scanResults.map((result) => result.fingerprint);
    console.log("[WowUpFingerprints]", JSON.stringify(fingerprints));
    const fingerprintResponse = await this.getAddonsByFingerprints(fingerprints);

    for (const scanResult of scanResults) {
      const fingerprintMatches = fingerprintResponse.exactMatches.filter((exactMatch) =>
        this.hasMatchingFingerprint(scanResult, exactMatch.matched_release)
      );

      let clientMatch = fingerprintMatches.find((exactMatch) => this.hasGameType(exactMatch.matched_release, gameType));

      if (!clientMatch && fingerprintMatches.length > 0) {
        console.warn(`No matching client type found for ${scanResult.folderName}, using fallback`);
        clientMatch = fingerprintMatches[0];
      }

      scanResult.exactMatch = clientMatch;
    }

    for (const addonFolder of addonFolders) {
      const scanResult = scanResults.find((sr) => sr.path === addonFolder.path);
      if (!scanResult || !scanResult.exactMatch) {
        continue;
      }

      try {
        const newAddon = this.getAddon(installation, addonChannelType, scanResult);

        addonFolder.matchingAddon = newAddon;
      } catch (err) {
        console.error(scanResult);
        console.error(err);
      }
    }
  }

  public async getChangelog(
    installation: WowInstallation,
    externalId: string,
    externalReleaseId: string
  ): Promise<string> {
    console.debug("getChangelog");
    try {
      const addon = await this.getReleaseById(externalId, externalReleaseId);
      return addon?.release?.body ?? "";
    } catch (e) {
      console.error("Failed to get changelog", e);
    }

    return "";
  }

  public getScanResults = async (addonFolders: AddonFolder[]): Promise<AppWowUpScanResult[]> => {
    const filePaths = addonFolders.map((addonFolder) => addonFolder.path);
    const scanResults: AppWowUpScanResult[] = await this._electronService.invoke(IPC_WOWUP_GET_SCAN_RESULTS, filePaths);
    return scanResults;
  };

  private async getAddonsByCategory(gameType: WowGameType, category: AddonCategory) {
    const url = new URL(`${API_URL}/addons/category/${category}/${gameType}`);
    return await this._cachingService.transaction(
      url.toString(),
      () => this._circuitBreaker.getJson<WowUpGetAddonsResponse>(url),
      CHANGELOG_CACHE_TTL_SEC
    );
  }

  private async getAddonById(addonId: number | string) {
    const url = new URL(`${API_URL}/addons/${addonId}`);
    return await this._cachingService.transaction(
      url.toString(),
      () => this._circuitBreaker.getJson<WowUpGetAddonResponse>(url),
      CHANGELOG_CACHE_TTL_SEC
    );
  }

  private hasMatchingFingerprint(
    scanResult: WowUpScanResult,
    release: WowUpAddonReleaseRepresentation | undefined
  ): boolean {
    if (!release?.addonFolders) {
      return false;
    }

    return release.addonFolders.some((addonFolder) => addonFolder.fingerprint == scanResult.fingerprint);
  }

  private hasGameType(release: WowUpAddonReleaseRepresentation | undefined, clientType: WowGameType): boolean {
    if (!release) {
      return false;
    }

    const matchingVersion = this.getMatchingVersion(release, clientType);
    return matchingVersion !== undefined;
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

  // Only 1 game version should match a given game type
  private getMatchingVersion(release: WowUpAddonReleaseRepresentation, gameType: WowGameType) {
    return release.game_versions.find((gv) => gv.game_type === gameType);
  }

  private getSearchResultFile(
    release: WowUpAddonReleaseRepresentation,
    gameType: WowGameType
  ): AddonSearchResultFile | undefined {
    const matchingVersion = this.getMatchingVersion(release, gameType);
    if (!matchingVersion) {
      return undefined;
    }

    return this.getSearchResultFileWithVersion(release, matchingVersion);
  }

  private getSearchResultFileWithVersion(
    release: WowUpAddonReleaseRepresentation,
    matchingVersion: AddonReleaseGameVersion
  ): AddonSearchResultFile | undefined {
    const version = matchingVersion?.version || release.tag_name || "";

    return {
      channelType: this.getAddonReleaseChannel(release),
      downloadUrl: release.download_url,
      folders: [],
      gameVersion: getGameVersion(matchingVersion?.interface),
      releaseDate: release.published_at,
      version: version,
      dependencies: [],
      changelog: release.body,
      externalId: release.id.toString(),
      title: matchingVersion?.title,
      authors: matchingVersion?.authors,
    };
  }

  private filterReleases(representation: WowUpAddonRepresentation, gameType: WowGameType) {
    return _.filter(representation.releases, (release) =>
      release.game_versions.some((gv) => gv.game_type === gameType)
    );
  }

  private getSearchResult(
    representation: WowUpAddonRepresentation,
    gameType: WowGameType
  ): AddonSearchResult | undefined {
    const clientReleases = this.filterReleases(representation, gameType);
    const searchResultFiles: AddonSearchResultFile[] = _.map(clientReleases, (release) =>
      this.getSearchResultFile(release, gameType)
    ).filter((sr) => sr !== undefined);

    if (searchResultFiles.length === 0) {
      return undefined;
    }

    const name = _.first(searchResultFiles)?.title ?? representation.repository_name;
    const authors = _.first(searchResultFiles)?.authors ?? representation.owner_name ?? "";

    return {
      author: authors,
      externalId: representation.id.toString(),
      externalUrl: `${AppConfig.wowUpWebsiteUrl}/addons/${representation.id}`,
      name,
      providerName: this.name,
      thumbnailUrl: representation.image_url || representation.owner_image_url || "",
      downloadCount: representation.total_download_count,
      files: searchResultFiles,
      releasedAt: new Date(),
      summary: representation.description,
      fundingLinks: [...(representation?.funding_links ?? [])],
      screenshotUrls: this.getScreenshotUrls(clientReleases),
    };
  }

  private getSearchResultWithReleases(
    representation: WowUpAddonRepresentation,
    releases: WowUpAddonReleaseRepresentation[]
  ): AddonSearchResult | undefined {
    const searchResultFiles: AddonSearchResultFile[] = _.flatMap(releases, (release) =>
      _.map(release.game_versions, (gv) => this.getSearchResultFileWithVersion(release, gv))
    ).filter((sr) => sr !== undefined);

    if (searchResultFiles.length === 0) {
      return undefined;
    }

    const name = _.first(searchResultFiles)?.title ?? representation.repository_name;
    const authors = _.first(searchResultFiles)?.authors ?? representation.owner_name ?? "";

    return {
      author: authors,
      externalId: representation.id.toString(),
      externalUrl: `${AppConfig.wowUpWebsiteUrl}/addons/${representation.id}`,
      name,
      providerName: this.name,
      thumbnailUrl: representation.image_url || representation.owner_image_url || "",
      downloadCount: representation.total_download_count,
      files: searchResultFiles,
      releasedAt: new Date(),
      summary: representation.description,
      fundingLinks: [...(representation?.funding_links ?? [])],
      screenshotUrls: this.getScreenshotUrls(releases),
    };
  }

  // Currently we only support images, so we filter for those
  private getScreenshotUrls(releases: WowUpAddonReleaseRepresentation[]): string[] {
    const urls = _.flatten(
      releases.map((release) =>
        release.previews?.filter((preview) => preview.preview_type === "image").map((preview) => preview.url)
      )
    ).filter((url) => !!url);

    return _.uniq(urls);
  }

  private getAddon(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    scanResult: AppWowUpScanResult
  ): Addon {
    const gameType = this.getWowGameType(installation.clientType);
    const matchedRelease = scanResult.exactMatch?.matched_release;
    if (!matchedRelease || !matchedRelease.addonFolders) {
      throw new Error("No matched release");
    }

    const folders = matchedRelease.addonFolders.map((af) => af.folder_name);
    const folderList = folders.join(", ");
    const channelType = addonChannelType;

    let matchingVersion = this.getMatchingVersion(matchedRelease, gameType);
    if (!matchingVersion) {
      matchingVersion = matchedRelease.game_versions[0];
      console.warn(
        `No matching version found: ${scanResult.exactMatch?.repository_name ?? ""}, using fallback ${
          matchingVersion?.interface ?? ""
        }`
      );
    }

    const name = matchingVersion?.title || scanResult.exactMatch?.repository_name;
    const version = matchingVersion?.version || scanResult.exactMatch?.matched_release?.tag_name || "";
    const authors = matchingVersion?.authors || scanResult.exactMatch?.owner_name || "";
    const interfaceVer = matchingVersion?.interface;

    if (!name || !version || !interfaceVer) {
      throw new Error(`Invalid matching version data: name ${name}, version ${version}, interfaceVer ${interfaceVer}`);
    }

    const screenshotUrls = this.getScreenshotUrls([matchedRelease]);
    const externalUrl = scanResult.exactMatch
      ? `${AppConfig.wowUpWebsiteUrl}/addons/${scanResult.exactMatch.id}`
      : "unknown";

    return {
      id: uuidv4(),
      author: authors,
      name,
      channelType,
      autoUpdateEnabled: false,
      autoUpdateNotificationsEnabled: false,
      clientType: installation.clientType,
      downloadUrl: scanResult.exactMatch?.matched_release?.download_url ?? "",
      externalUrl,
      externalId: scanResult.exactMatch?.id.toString() ?? "unknown",
      gameVersion: getGameVersion(interfaceVer),
      installedAt: new Date(),
      installedFolders: folderList,
      installedFolderList: folders,
      installedVersion: version,
      installedExternalReleaseId: scanResult.exactMatch?.matched_release?.id.toString() ?? "unknown",
      isIgnored: false,
      latestVersion: version,
      providerName: this.name,
      providerSource: scanResult.exactMatch?.source ?? "unknown",
      thumbnailUrl: scanResult.exactMatch?.image_url ?? "",
      fundingLinks: [...(scanResult.exactMatch?.funding_links ?? [])],
      isLoadOnDemand: false,
      releasedAt: scanResult.exactMatch?.matched_release?.published_at,
      externalChannel: getEnumName(AddonChannelType, channelType),
      latestChangelog: scanResult.exactMatch?.matched_release?.body,
      externalLatestReleaseId: scanResult?.exactMatch?.matched_release?.id?.toString(),
      installationId: installation.id,
      screenshotUrls,
    };
  }

  private getWowGameType(clientType: WowClientType): WowGameType {
    switch (clientType) {
      case WowClientType.ClassicEra:
      case WowClientType.ClassicEraPtr:
        return WowGameType.Classic;
      case WowClientType.Classic:
      case WowClientType.ClassicPtr:
      case WowClientType.ClassicBeta:
        return WowGameType.WOTLK;
      case WowClientType.Retail:
      case WowClientType.RetailPtr:
      case WowClientType.Beta:
      default:
        return WowGameType.Retail;
    }
  }

  private getWowClientGroup(gameType: WowGameType): WowClientGroup {
    switch (gameType) {
      case WowGameType.BurningCrusade:
        return WowClientGroup.BurningCrusade;
      case WowGameType.Classic:
        return WowClientGroup.Classic;
      case WowGameType.Retail:
        return WowClientGroup.Retail;
      case WowGameType.WOTLK:
        return WowClientGroup.WOTLK;
    }
  }
}
