import * as _ from "lodash";
import { from, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";

import {
  ADDON_PROVIDER_CURSEFORGE,
  IPC_CURSE_GET_SCAN_RESULTS,
  NO_LATEST_SEARCH_RESULT_FILES_ERROR,
  NO_SEARCH_RESULTS_ERROR,
} from "../../common/constants";
import { CurseAuthor } from "../../common/curse/curse-author";
import { CurseDependency } from "../../common/curse/curse-dependency";
import { CurseDependencyType } from "../../common/curse/curse-dependency-type";
import { CurseFile } from "../../common/curse/curse-file";
import { CurseMatch } from "../../common/curse/curse-match";
import { CurseReleaseType } from "../../common/curse/curse-release-type";
import { CurseScanResult } from "../../common/curse/curse-scan-result";
import { CurseSearchResult } from "../../common/curse/curse-search-result";
import { AppConfig } from "../../environments/environment";
import { Addon } from "../entities/addon";
import { AppCurseScanResult } from "../models/curse/app-curse-scan-result";
import { CurseFingerprintsResponse } from "../models/curse/curse-fingerprint-response";
import { CurseGetFeaturedResponse } from "../models/curse/curse-get-featured-response";
import { WowClientType } from "../models/warcraft/wow-client-type";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonDependencyType } from "../models/wowup/addon-dependency-type";
import { AddonFolder } from "../models/wowup/addon-folder";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { AddonSearchResultDependency } from "../models/wowup/addon-search-result-dependency";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";
import { ElectronService } from "../services";
import { CachingService } from "../services/caching/caching-service";
import { CircuitBreakerWrapper, NetworkService } from "../services/network/network.service";
import { WowUpApiService } from "../services/wowup-api/wowup-api.service";
import { getEnumName } from "../utils/enum.utils";
import { AddonProvider, GetAllResult } from "./addon-provider";

const API_URL = "https://addons-ecs.forgesvc.net/api/v2";
const CHANGELOG_CACHE_TTL_SEC = 30 * 60;

export class CurseAddonProvider extends AddonProvider {
  private readonly _circuitBreaker: CircuitBreakerWrapper;

  public readonly name = ADDON_PROVIDER_CURSEFORGE;
  public readonly forceIgnore = false;
  public readonly allowReinstall = true;
  public readonly allowChannelChange = true;
  public readonly allowEdit = true;
  public enabled = true;

  constructor(
    private _cachingService: CachingService,
    private _electronService: ElectronService,
    private _wowupApiService: WowUpApiService,
    _networkService: NetworkService
  ) {
    super();

    this._circuitBreaker = _networkService.getCircuitBreaker(`${this.name}_main`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async getDescription(clientType: WowClientType, externalId: string, addon?: Addon): Promise<string> {
    try {
      const cacheKey = `${this.name}_description_${externalId}`;
      let description = await this._cachingService.transaction(
        cacheKey,
        () => {
          const url = new URL(`${API_URL}/addon/${externalId}/description`);
          return this._circuitBreaker.getText(url);
        },
        CHANGELOG_CACHE_TTL_SEC
      );

      description = this.standardizeDescription(description);

      return description;
    } catch (e) {
      console.error("Failed to get changelog", e);
    }

    return "";
  }

  public async getChangelog(clientType: WowClientType, externalId: string, externalReleaseId: string): Promise<string> {
    try {
      const cacheKey = `${this.name}_changelog_${externalId}_${externalReleaseId}`;
      return await this._cachingService.transaction(
        cacheKey,
        () => {
          const url = new URL(`${API_URL}/addon/${externalId}/file/${externalReleaseId}/changelog`);
          return this._circuitBreaker.getText(url);
        },
        CHANGELOG_CACHE_TTL_SEC
      );
    } catch (e) {
      console.error("Failed to get changelog", e);
    }

    return "";
  }

  public async scan(
    clientType: WowClientType,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {
    if (!addonFolders.length) {
      return;
    }

    console.time("CFScan");
    const scanResults = await this.getScanResults(addonFolders);
    console.timeEnd("CFScan");

    await this.mapAddonFolders(scanResults, clientType);

    const matchedScanResults = scanResults.filter((sr) => !!sr.exactMatch);
    const matchedScanResultIds = matchedScanResults.map((sr) => sr.exactMatch.id);
    const addonIds = _.uniq(matchedScanResultIds);

    const addonResults = await this.getAllIds(addonIds);

    for (const addonFolder of addonFolders) {
      const scanResult = scanResults.find((sr) => sr.addonFolder.name === addonFolder.name);
      if (!scanResult.exactMatch) {
        continue;
      }

      scanResult.searchResult = addonResults.find((addonResult) => addonResult.id === scanResult.exactMatch.id);
      if (!scanResult.searchResult) {
        continue;
      }

      try {
        const newAddon = this.getAddon(clientType, scanResult);

        addonFolder.matchingAddon = newAddon;
      } catch (err) {
        console.error(scanResult);
        console.error(err);
      }
    }
  }

  public getScanResults = async (addonFolders: AddonFolder[]): Promise<AppCurseScanResult[]> => {
    const filePaths = addonFolders.map((addonFolder) => addonFolder.path);
    const scanResults: CurseScanResult[] = await this._electronService.invoke(IPC_CURSE_GET_SCAN_RESULTS, filePaths);

    const appScanResults: AppCurseScanResult[] = scanResults.map((scanResult) => {
      const addonFolder = addonFolders.find((af) => af.path === scanResult.directory);

      return Object.assign({}, scanResult, { addonFolder });
    });

    return appScanResults;
  };

  /** We want to pull all the A tags and fix what we can */
  private standardizeDescription(description: string): string {
    let descriptionCpy = `${description}`;
    const hrefRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/g;
    const results = descriptionCpy.matchAll(hrefRegex);
    const resultArr = [...results];
    for (const result of resultArr) {
      try {
        const href = result[2];
        if (!href) {
          continue;
        }

        if (href.toLowerCase().indexOf("/linkout") === 0) {
          descriptionCpy = this.rebuildLinkOut(descriptionCpy, href);
        }
      } catch (e) {
        console.error(e);
      }
    }
    return descriptionCpy;
  }

  private rebuildLinkOut(description: string, href: string) {
    const url = new URL(`https://www.curseforge.com${href}`);
    const remoteUrl = url.searchParams.get("remoteUrl");
    const destination = window.decodeURIComponent(remoteUrl);
    return description.replace(href, destination);
  }

  private async mapAddonFolders(scanResults: AppCurseScanResult[], clientType: WowClientType) {
    if (clientType === WowClientType.None) {
      return;
    }

    const fingerprintResponse = await this.getAddonsByFingerprintsW(scanResults.map((result) => result.fingerprint));

    for (const scanResult of scanResults) {
      // Curse can deliver the wrong result sometimes, ensure the result matches the client type
      scanResult.exactMatch = fingerprintResponse.exactMatches.find(
        (exactMatch) =>
          this.isGameVersionFlavor(exactMatch.file.gameVersionFlavor, clientType) &&
          this.hasMatchingFingerprint(scanResult, exactMatch)
      );

      // If the addon does not have an exact match, check the partial matches.
      if (!scanResult.exactMatch && fingerprintResponse.partialMatches) {
        scanResult.exactMatch = fingerprintResponse.partialMatches.find((partialMatch) =>
          partialMatch.file?.modules?.some((module) => module.fingerprint === scanResult.fingerprint)
        );
      }
    }
  }

  private hasMatchingFingerprint(scanResult: AppCurseScanResult, exactMatch: CurseMatch) {
    return exactMatch.file.modules.some((m) => m.fingerprint === scanResult.fingerprint);
  }

  private isGameVersionFlavor(gameVersionFlavor: string, clientType: WowClientType) {
    return gameVersionFlavor === this.getGameVersionFlavor(clientType);
  }

  private async getAddonsByFingerprintsW(fingerprints: number[]) {
    const url = `${AppConfig.wowUpHubUrl}/curseforge/addons/fingerprint`;

    console.log(`Wowup Fetching fingerprints`, JSON.stringify(fingerprints));

    const response = await this._circuitBreaker.postJson<CurseFingerprintsResponse>(
      url,
      {
        fingerprints,
      },
      AppConfig.wowUpHubHttpTimeoutMs
    );

    return response;
  }

  private async getAddonsByFingerprints(fingerprints: number[]): Promise<CurseFingerprintsResponse> {
    const url = `${API_URL}/fingerprint`;

    console.log(`Curse Fetching fingerprints`, JSON.stringify(fingerprints));

    return await this._circuitBreaker.postJson(url, fingerprints);
  }

  private async getAllIds(addonIds: number[]): Promise<CurseSearchResult[]> {
    if (!addonIds?.length) {
      return [];
    }

    const url = `${API_URL}/addon`;
    console.log(`Fetching addon info ${url} ${addonIds.length}`);
    const response = await this._circuitBreaker.postJson<CurseSearchResult[]>(url, addonIds);

    await this.removeBlockedItems(response);

    return response;
  }

  private sendRequest<T>(action: () => Promise<T>): Promise<T> {
    return action.call(this);
  }

  async getAll(clientType: WowClientType, addonIds: string[]): Promise<GetAllResult> {
    if (!addonIds.length) {
      return {
        searchResults: [],
        errors: [],
      };
    }

    const addonResults: AddonSearchResult[] = [];
    const searchResults = await this.getAllIds(addonIds.map((id) => parseInt(id, 10)));

    for (const result of searchResults) {
      const latestFiles = this.getLatestFiles(result, clientType);
      if (!latestFiles.length) {
        continue;
      }

      const addonSearchResult = this.getAddonSearchResult(result, latestFiles);
      if (addonSearchResult) {
        addonResults.push(addonSearchResult);
      }
    }

    return {
      errors: [],
      searchResults: addonResults,
    };
  }

  public async getFeaturedAddons(clientType: WowClientType): Promise<AddonSearchResult[]> {
    const addons = await this.getFeaturedAddonList();
    const filteredAddons = this.filterFeaturedAddons(addons, clientType);

    await this.removeBlockedItems(filteredAddons);

    return filteredAddons.map((addon) => {
      const latestFiles = this.getLatestFiles(addon, clientType);
      return this.getAddonSearchResult(addon, latestFiles);
    });
  }

  async searchByQuery(
    query: string,
    clientType: WowClientType,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    channelType?: AddonChannelType
  ): Promise<AddonSearchResult[]> {
    const searchResults: AddonSearchResult[] = [];

    const response = await this.getSearchResults(query);

    await this.removeBlockedItems(response);

    for (const result of response) {
      const latestFiles = this.getLatestFiles(result, clientType);
      if (!latestFiles.length) {
        continue;
      }

      searchResults.push(this.getAddonSearchResult(result, latestFiles));
    }

    return searchResults;
  }

  async searchByUrl(addonUri: URL, clientType: WowClientType): Promise<AddonSearchResult> {
    const slugRegex = /\/addons\/(.*?)(\/|$)/gi;
    const slugMatch = slugRegex.exec(addonUri.pathname);
    if (!slugMatch) {
      return null;
    }
    return await this.searchBySlug(slugMatch[1], clientType);
  }

  private async searchBySlug(slug: string, clientType: WowClientType) {
    const searchWord = _.first(slug.split("-"));
    const response = await this.getSearchResults(searchWord);

    await this.removeBlockedItems(response);

    const match = _.find(response, (res) => res.slug === slug);
    if (!match) {
      throw new Error(NO_SEARCH_RESULTS_ERROR);
    }

    const latestFiles = this.getLatestFiles(match, clientType);
    if (!latestFiles?.length) {
      throw new Error(NO_LATEST_SEARCH_RESULT_FILES_ERROR);
    }

    return this.getAddonSearchResult(match, latestFiles);
  }

  private async getSearchResults(query: string): Promise<CurseSearchResult[]> {
    const url = new URL(`${API_URL}/addon/search`);
    url.searchParams.set("gameId", "1");
    url.searchParams.set("searchFilter", query);

    return await this._circuitBreaker.getJson<CurseSearchResult[]>(url);
  }

  getById(addonId: string, clientType: WowClientType): Observable<AddonSearchResult> {
    const url = `${API_URL}/addon/${addonId}`;

    return from(this._circuitBreaker.getJson<CurseSearchResult>(url)).pipe(
      map((result) => {
        if (!result) {
          return null;
        }

        const latestFiles = this.getLatestFiles(result, clientType);
        if (!latestFiles?.length) {
          return null;
        }

        return this.getAddonSearchResult(result, latestFiles);
      })
    );
  }

  isValidAddonUri(addonUri: URL): boolean {
    return addonUri.host && addonUri.host.endsWith("curseforge.com") && addonUri.pathname.startsWith("/wow/addons");
  }

  isValidAddonId(addonId: string): boolean {
    return !!addonId && !isNaN(parseInt(addonId, 10));
  }

  private getAddonSearchResult(result: CurseSearchResult, latestFiles: CurseFile[] = []): AddonSearchResult {
    try {
      const thumbnailUrl = this.getThumbnailUrl(result);
      const id = result.id;
      const name = result.name;
      const author = this.getAuthor(result);

      const searchResultFiles: AddonSearchResultFile[] = latestFiles.map((lf) => {
        return {
          channelType: this.getChannelType(lf.releaseType),
          version: lf.displayName,
          downloadUrl: lf.downloadUrl,
          folders: this.getFolderNames(lf),
          gameVersion: this.getGameVersion(lf),
          releaseDate: new Date(lf.fileDate),
          dependencies: lf.dependencies.map(this.createAddonSearchResultDependency),
          externalId: lf.id.toString(),
        };
      });

      const searchResult: AddonSearchResult = {
        author,
        externalId: id.toString(),
        name,
        thumbnailUrl,
        externalUrl: result.websiteUrl,
        providerName: this.name,
        files: _.orderBy(searchResultFiles, (f) => f.channelType).reverse(),
        downloadCount: result.downloadCount,
        summary: result.summary,
      };

      return searchResult;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  private async removeBlockedItems(searchResults: CurseSearchResult[]) {
    const blockedResults: number[] = [];

    for (const result of searchResults) {
      for (const author of result.authors) {
        const isBlocked = await this.isBlockedAuthor(author);
        if (isBlocked) {
          blockedResults.push(result.id);
          break;
        }
      }
    }

    _.remove(searchResults, (sr) => blockedResults.includes(sr.id));
  }

  private async isBlockedAuthor(author: CurseAuthor) {
    try {
      const blockList = await this._wowupApiService.getBlockList().toPromise();
      const blockedAuthorIds = _.map(blockList.curse.authors, (author) => author.authorId);
      return blockedAuthorIds.includes(author.id.toString()) || blockedAuthorIds.includes(author.userId.toString());
    } catch (e) {
      return false;
    }
  }

  private filterFeaturedAddons(results: CurseSearchResult[], clientType: WowClientType) {
    const clientTypeStr = this.getGameVersionFlavor(clientType);

    return results.filter((r) => r.latestFiles.some((lf) => this.isClientType(lf, clientTypeStr)));
  }

  private isClientType(file: CurseFile, clientTypeStr: string) {
    return (
      file.releaseType === CurseReleaseType.Release &&
      file.gameVersionFlavor === clientTypeStr &&
      file.isAlternate === false
    );
  }

  private createAddonSearchResultDependency = (dependency: CurseDependency): AddonSearchResultDependency => {
    return {
      externalAddonId: dependency.addonId.toString(),
      type: this.toAddonDependencyType(dependency.type),
    };
  };

  private toAddonDependencyType(curseDependencyType: CurseDependencyType): AddonDependencyType {
    switch (curseDependencyType) {
      case CurseDependencyType.EmbeddedLibrary:
        return AddonDependencyType.Embedded;
      case CurseDependencyType.OptionalDependency:
        return AddonDependencyType.Optional;
      case CurseDependencyType.RequiredDependency:
        return AddonDependencyType.Required;
      case CurseDependencyType.Include:
      case CurseDependencyType.Incompatible:
      case CurseDependencyType.Tool:
      default:
        return AddonDependencyType.Other;
    }
  }

  private async getFeaturedAddonList(): Promise<CurseSearchResult[]> {
    const url = `${API_URL}/addon/featured`;

    const body = {
      gameId: 1,
      featuredCount: 6,
      popularCount: 50,
      updatedCount: 0,
    };

    const result = await this._cachingService.transaction(url, () =>
      this._circuitBreaker.postJson<CurseGetFeaturedResponse>(url, body)
    );

    if (!result) {
      return [];
    }

    return result.Popular;
  }

  private getChannelType(releaseType: CurseReleaseType): AddonChannelType {
    switch (releaseType) {
      case CurseReleaseType.Alpha:
        return AddonChannelType.Alpha;
      case CurseReleaseType.Beta:
        return AddonChannelType.Beta;
      case CurseReleaseType.Release:
      default:
        return AddonChannelType.Stable;
    }
  }

  private getFolderNames(file: CurseFile): string[] {
    return file.modules.map((m) => m.foldername);
  }

  private getGameVersion(file: CurseFile): string {
    return _.first(file.gameVersion);
  }

  private getAuthor(result: CurseSearchResult): string {
    const authorNames = result.authors.map((a) => a.name).filter((lf) => !lf.toLowerCase().startsWith("_forgeuser"));
    return authorNames.join(", ");
  }

  private getThumbnailUrl(result: CurseSearchResult): string {
    const attachment = result.attachments.find((f) => f.isDefault && !!f.thumbnailUrl);
    return attachment?.thumbnailUrl;
  }

  private getScreenshotUrls(result: CurseSearchResult): string[] {
    return result.attachments.map((f) => f.url).filter(Boolean);
  }

  private getLatestFiles(result: CurseSearchResult, clientType: WowClientType): CurseFile[] {
    const clientTypeStr = this.getGameVersionFlavor(clientType);
    const filtered = result.latestFiles.filter(
      (lf) => lf.isAlternate === false && lf.gameVersionFlavor === clientTypeStr
    );
    return _.sortBy(filtered, (lf) => lf.id).reverse();
  }

  private getGameVersionFlavor(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Classic:
      case WowClientType.ClassicPtr:
        return "wow_classic";
      case WowClientType.Retail:
      case WowClientType.RetailPtr:
      case WowClientType.Beta:
      default:
        return "wow_retail";
    }
  }

  private getWowUpChannel(releaseType: CurseReleaseType): AddonChannelType {
    switch (releaseType) {
      case CurseReleaseType.Alpha:
        return AddonChannelType.Alpha;
      case CurseReleaseType.Beta:
        return AddonChannelType.Beta;
      case CurseReleaseType.Release:
      default:
        return AddonChannelType.Stable;
    }
  }

  private getAddon(clientType: WowClientType, scanResult: AppCurseScanResult): Addon {
    const currentVersion = scanResult.exactMatch.file;

    const authors = scanResult.searchResult.authors.map((author) => author.name).join(", ");

    const folders = scanResult.exactMatch.file.modules.map((module) => module.foldername);
    const folderList = folders.join(",");

    const latestFiles = this.getLatestFiles(scanResult.searchResult, clientType);

    const gameVersion = currentVersion.gameVersion[0] || scanResult.addonFolder.toc.interface;

    let channelType = this.getChannelType(scanResult.exactMatch.file.releaseType);
    let latestVersion = latestFiles.find((lf) => this.getChannelType(lf.releaseType) <= channelType);

    // If there were no releases that met the channel type restrictions
    if (!latestVersion) {
      latestVersion = _.first(latestFiles);
      channelType = this.getWowUpChannel(latestVersion.releaseType);
      console.warn("falling back to default channel");
    }

    return {
      id: uuidv4(),
      author: authors,
      name: scanResult.searchResult.name,
      channelType,
      autoUpdateEnabled: false,
      clientType,
      downloadUrl: latestVersion.downloadUrl,
      externalUrl: scanResult.searchResult.websiteUrl,
      externalId: scanResult.searchResult.id.toString(),
      gameVersion: gameVersion,
      installedAt: new Date(scanResult.addonFolder.fileStats.birthtimeMs),
      installedFolders: folderList,
      installedFolderList: folders,
      installedVersion: currentVersion.displayName,
      installedExternalReleaseId: currentVersion.id.toString(),
      isIgnored: false,
      latestVersion: latestVersion.displayName,
      providerName: this.name,
      thumbnailUrl: this.getThumbnailUrl(scanResult.searchResult),
      screenshotUrls: this.getScreenshotUrls(scanResult.searchResult),
      downloadCount: scanResult.searchResult.downloadCount,
      summary: scanResult.searchResult.summary,
      releasedAt: new Date(latestVersion.fileDate),
      isLoadOnDemand: false,
      externalLatestReleaseId: latestVersion.id.toString(),
      updatedAt: scanResult.addonFolder.fileStats.birthtime,
      externalChannel: getEnumName(AddonChannelType, channelType),
    };
  }
}
