import * as _ from "lodash";
import { from, Observable, of } from "rxjs";
import { catchError, filter, map, switchMap } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";
import {
  CF2Addon,
  CF2Author,
  CF2File,
  CF2FileDependency,
  CF2FileRelationType,
  CF2FileReleaseType,
  CF2FingerprintMatch,
  CF2FingerprintsMatchesResult,
  CF2GetFeaturedModsRequest,
  CF2GetFingerprintMatchesRequest,
  CF2GetModsRequest,
  CF2SearchModsParams,
  CF2WowGameVersionType,
  CFV2Client,
} from "curseforge-v2";

import {
  ADDON_PROVIDER_CURSEFORGEV2,
  NO_LATEST_SEARCH_RESULT_FILES_ERROR,
  NO_SEARCH_RESULTS_ERROR,
  PREF_CF2_API_KEY,
} from "../../common/constants";
import { CurseAddonCategory, CurseGameVersionFlavor } from "../../common/curse/curse-models";
import { Addon } from "../../common/entities/addon";
import { WowClientGroup, WowClientType } from "../../common/warcraft/wow-client-type";
import { AddonCategory, AddonChannelType, AddonDependencyType, AddonWarningType } from "../../common/wowup/models";
import { AppConfig } from "../../environments/environment";
import { SourceRemovedAddonError } from "../errors";
import { AppCurseV2ScanResult } from "../models/curse/app-curse-scan-result";
import { AddonFolder } from "../models/wowup/addon-folder";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { AddonSearchResultDependency } from "../models/wowup/addon-search-result-dependency";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";
import { ProtocolSearchResult } from "../models/wowup/protocol-search-result";
import { WowInstallation } from "../../common/warcraft/wow-installation";
import { ElectronService } from "../services";
import { CachingService } from "../services/caching/caching-service";
import { CircuitBreakerWrapper, NetworkService } from "../services/network/network.service";
import { WowUpApiService } from "../services/wowup-api/wowup-api.service";
import * as AddonUtils from "../utils/addon.utils";
import { getEnumName } from "../utils/enum.utils";
import { AddonProvider, GetAllBatchResult, GetAllResult, SearchByUrlResult } from "./addon-provider";
import { strictFilter } from "../utils/array.utils";
import { TocService } from "../services/toc/toc.service";
import { WarcraftService } from "../services/warcraft/warcraft.service";
import { SensitiveStorageService } from "../services/storage/sensitive-storage.service";
import { getWowClientGroup } from "../../common/warcraft";

interface ProtocolData {
  addonId: number;
  fileId: number;
}

const CHANGELOG_CACHE_TTL_SEC = 30 * 60;
const FEATURED_ADDONS_CACHE_TTL_SEC = AppConfig.featuredAddonsCacheTimeSec;

const GAME_TYPE_LISTS = [
  {
    flavor: "wow_classic",
    typeId: 67408,
    matches: [WowClientType.ClassicEra, WowClientType.ClassicEraPtr],
  },
  {
    flavor: "wow_burning_crusade",
    typeId: 73246,
    matches: [WowClientType.Classic, WowClientType.ClassicPtr, WowClientType.ClassicBeta],
  },
  {
    flavor: "wow_retail",
    typeId: 517,
    matches: [WowClientType.Retail, WowClientType.RetailPtr, WowClientType.Beta],
  },
];

export class CurseAddonV2Provider extends AddonProvider {
  private readonly _circuitBreaker: CircuitBreakerWrapper;

  private _cfClient: CFV2Client;

  public readonly name = ADDON_PROVIDER_CURSEFORGEV2;
  public readonly forceIgnore = false;
  public readonly allowReinstall = true;
  public readonly allowChannelChange = true;
  public readonly allowEdit = true;
  public readonly canBatchFetch = true;
  public readonly providerNote = "PAGES.OPTIONS.ADDON.CURSE_FORGE_V2.PROVIDER_NOTE";

  // Disabled by default due to requiring a key
  public enabled = false; 

  public constructor(
    private _cachingService: CachingService,
    private _electronService: ElectronService,
    private _wowupApiService: WowUpApiService,
    private _warcraftService: WarcraftService,
    private _tocService: TocService,
    private _sensitiveStorageService: SensitiveStorageService,
    _networkService: NetworkService
  ) {
    super();

    this._circuitBreaker = _networkService.getCircuitBreaker(
      `${this.name}_main`,
      undefined,
      AppConfig.curseforge.httpTimeoutMs
    );

    // Pick up a CF2 api key change at runtime to force a new client to be created
    this._sensitiveStorageService.change$.pipe(filter((change) => change.key === PREF_CF2_API_KEY)).subscribe(() => {
      this._cfClient = undefined;
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async getDescription(installation: WowInstallation, externalId: string, addon?: Addon): Promise<string> {
    try {
      const client = await this.getClient();

      const cacheKey = `${this.name}_description_${externalId}`;
      const response = await this._cachingService.transaction(
        cacheKey,
        () => {
          return client.getModDescription(parseInt(externalId, 10));
        },
        CHANGELOG_CACHE_TTL_SEC
      );

      const description = this.standardizeDescription(response.data.data);

      return description;
    } catch (e) {
      console.error("Failed to get changelog", e);
    }

    return "";
  }

  public isValidProtocol(protocol: string): boolean {
    return protocol.toLowerCase().startsWith("curseforge://");
  }

  public async searchProtocol(protocol: string): Promise<ProtocolSearchResult | undefined> {
    const protocolData = this.parseProtocol(protocol);
    if (!protocolData.addonId || !protocolData.fileId) {
      throw new Error("Invalid protocol data");
    }

    const addonResult = await this.getByIdBase(protocolData.addonId.toString()).toPromise();
    if (!addonResult) {
      throw new Error(`Failed to get addon data: ${protocolData.addonId}`);
    }

    for (const author of addonResult.authors) {
      if (await this.isBlockedAuthor(author)) {
        console.info(`Blocklist addon detected`, addonResult.name);
        return undefined;
      }
    }

    console.debug("addonResult", addonResult);

    const addonFileResponse = await this.getAddonFileById(protocolData.addonId, protocolData.fileId).toPromise();
    console.debug("targetFile", addonFileResponse);

    if (!addonFileResponse) {
      throw new Error("Failed to get target file");
    }

    const addonSearchResult = this.getAddonSearchResult(addonResult, [addonFileResponse]);
    if (!addonSearchResult) {
      throw new Error("Addon search result not created");
    }

    const searchResult: ProtocolSearchResult = {
      protocol,
      protocolAddonId: protocolData.addonId.toString(),
      protocolReleaseId: protocolData.fileId.toString(),
      validClientTypes: this.getValidClientTypes(addonFileResponse),
      ...addonSearchResult,
    };
    console.debug("searchResult", searchResult);

    return searchResult;
  }

  private parseProtocol(protocol: string): ProtocolData {
    const url = new URL(protocol);
    return {
      addonId: +(url.searchParams.get("addonId") ?? ""),
      fileId: +(url.searchParams.get("fileId") ?? ""),
    };
  }

  public async getChangelog(
    installation: WowInstallation,
    externalId: string,
    externalReleaseId: string
  ): Promise<string> {
    try {
      const client = await this.getClient();
      const cacheKey = `${this.name}_changelog_${externalId}_${externalReleaseId}`;

      const response = await this._cachingService.transaction(
        cacheKey,
        () => {
          return client.getModFileChangelog(parseInt(externalId, 10), parseInt(externalReleaseId, 10));
        },
        CHANGELOG_CACHE_TTL_SEC
      );

      return response.data.data;
    } catch (e) {
      console.error("Failed to get changelog", e);
    }

    return "";
  }

  public shouldMigrate(addon: Addon): boolean {
    return !addon.installedExternalReleaseId;
  }

  public async scan(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {
    if (!addonFolders.length) {
      return;
    }

    const scanResults = this.getScanResults(addonFolders);

    await this.mapAddonFolders(scanResults, installation);

    const matchedScanResults = scanResults.filter((sr) => !!sr.exactMatch);
    const matchedScanResultIds = strictFilter(matchedScanResults.map((sr) => sr.exactMatch?.id));
    const addonIds = _.uniq(matchedScanResultIds);

    const addonResults = await this.getAllIds(addonIds);

    for (const addonFolder of addonFolders) {
      const scanResult = scanResults.find((sr) => sr.addonFolder?.name === addonFolder.name);
      if (scanResult === undefined || !scanResult.exactMatch) {
        continue;
      }

      scanResult.searchResult = addonResults.find((addonResult) => addonResult.id === scanResult.exactMatch?.id);
      if (!scanResult?.searchResult) {
        // If a folder did not have a match, and the folder has a CF toc id, try that
        // This can happen if the CF api is having issues returning latestFiles
        console.warn(`scan result missing for addon: ${addonFolder.name}`);
        const searchResult = await this.getByIdBase(scanResult.exactMatch.id.toString()).toPromise();
        if (searchResult) {
          addonResults.push(searchResult);
          scanResult.searchResult = searchResult;
        } else {
          console.warn(`Failed to get CurseForge addon data ${scanResult.exactMatch.id}`);
          continue;
        }
      }

      try {
        const newAddon = this.getAddon(installation, scanResult);

        addonFolder.matchingAddon = newAddon;
      } catch (err) {
        console.error(scanResult);
        console.error(err);
      }
    }
  }

  public getScanResults = (addonFolders: AddonFolder[]): AppCurseV2ScanResult[] => {
    const scanResults = addonFolders.map((af) => af.cfScanResults).filter((sr) => sr !== undefined);

    const appScanResults: AppCurseV2ScanResult[] = scanResults.map((scanResult) => {
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
    const remoteUrl = url.searchParams.get("remoteUrl") ?? "";
    const destination = window.decodeURIComponent(remoteUrl);
    return description.replace(href, destination);
  }

  private async mapAddonFolders(scanResults: AppCurseV2ScanResult[], installation: WowInstallation) {
    if (!installation) {
      return;
    }

    const fingerprintResponse = await this.getAddonsByFingerprints(scanResults.map((result) => result.fingerprint));
    if (fingerprintResponse === undefined) {
      return;
    }

    for (const scanResult of scanResults) {
      // Curse can deliver the wrong result sometimes, ensure the result matches the client type
      scanResult.exactMatch = fingerprintResponse.exactMatches.find((exactMatch) => {
        const hasMatchingFingerprint = this.hasMatchingFingerprint(scanResult, exactMatch);
        const isCompatible = this.isCompatible(installation.clientType, exactMatch.file);
        return hasMatchingFingerprint && isCompatible;
      });

      // If the addon does not have an exact match, check the partial matches.
      if (!scanResult.exactMatch && fingerprintResponse.partialMatches) {
        scanResult.exactMatch = fingerprintResponse.partialMatches.find((partialMatch) =>
          partialMatch.file?.modules?.some((module) => module.fingerprint === scanResult.fingerprint)
        );
      }
    }
  }

  private hasMatchingFingerprint(scanResult: AppCurseV2ScanResult, exactMatch: CF2FingerprintMatch) {
    return exactMatch.file.modules.some((m) => m.fingerprint === scanResult.fingerprint);
  }

  private async getAddonsByFingerprints(fingerprints: number[]): Promise<CF2FingerprintsMatchesResult | undefined> {
    console.log(`Curse Fetching fingerprints`, JSON.stringify(fingerprints));

    const client = await this.getClient();
    if (!client) {
      return undefined;
    }

    const request: CF2GetFingerprintMatchesRequest = {
      fingerprints,
    };

    const result = await this._circuitBreaker.fire(() => client.getFingerprintMatches(request));

    return result?.data?.data;
  }

  private async getAllIds(addonIds: number[]): Promise<CF2Addon[]> {
    if (!addonIds?.length) {
      return [];
    }

    const request: CF2GetModsRequest = {
      modIds: addonIds,
    };

    const client = await this.getClient();

    const response = await this._circuitBreaker.fire(() => client.getMods(request));

    await this.removeBlockedItems(response.data.data);

    return response.data.data;
  }

  public async getAllBatch(installations: WowInstallation[], addonIds: string[]): Promise<GetAllBatchResult> {
    const batchResult: GetAllBatchResult = {
      errors: {},
      installationResults: {},
    };

    if (!addonIds.length) {
      return batchResult;
    }

    const searchResults = await this.getAllIds(addonIds.map((id) => parseInt(id, 10)));

    for (const installation of installations) {
      const addonResults: AddonSearchResult[] = [];
      for (const result of searchResults) {
        const latestFiles = this.getLatestFiles(result, installation.clientType);
        if (!latestFiles.length) {
          continue;
        }

        const addonSearchResult = this.getAddonSearchResult(result, latestFiles);
        if (addonSearchResult) {
          addonResults.push(addonSearchResult);
        }
      }

      const missingAddonIds = _.filter(
        addonIds,
        (addonId) => _.find(searchResults, (sr) => sr.id.toString() === addonId) === undefined
      );

      batchResult.errors[installation.id] = _.map(
        missingAddonIds,
        (addonId) => new SourceRemovedAddonError(addonId, undefined)
      );

      batchResult.installationResults[installation.id] = addonResults;
    }

    return batchResult;
  }

  public async getAll(installation: WowInstallation, addonIds: string[]): Promise<GetAllResult> {
    if (!addonIds.length) {
      return {
        searchResults: [],
        errors: [],
      };
    }

    const addonResults: AddonSearchResult[] = [];
    const searchResults = await this.getAllIds(addonIds.map((id) => parseInt(id, 10)));

    for (const result of searchResults) {
      const latestFiles = this.getLatestFiles(result, installation.clientType);
      if (!latestFiles.length) {
        continue;
      }

      const addonSearchResult = this.getAddonSearchResult(result, latestFiles);
      if (addonSearchResult) {
        addonResults.push(addonSearchResult);
      }
    }

    const missingAddonIds = _.filter(
      addonIds,
      (addonId) => _.find(searchResults, (sr) => sr.id.toString() === addonId) === undefined
    );

    const deletedErrors = _.map(missingAddonIds, (addonId) => new SourceRemovedAddonError(addonId, undefined));

    return {
      errors: [...deletedErrors],
      searchResults: addonResults,
    };
  }

  public async getFeaturedAddons(installation: WowInstallation): Promise<AddonSearchResult[]> {
    const addons = await this.getFeaturedAddonList(installation);
    const filteredAddons = this.filterFeaturedAddons(addons, installation.clientType);

    await this.removeBlockedItems(filteredAddons);

    const mapped = filteredAddons.map((addon) => {
      const latestFiles = this.getLatestFiles(addon, installation.clientType);
      return this.getAddonSearchResult(addon, latestFiles);
    });

    return strictFilter(mapped);
  }

  public async searchByQuery(
    query: string,
    installation: WowInstallation,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    channelType?: AddonChannelType
  ): Promise<AddonSearchResult[]> {
    const searchResults: AddonSearchResult[] = [];

    const response = await this.getSearchResults(query, installation.clientType);

    await this.removeBlockedItems(response);

    for (const result of response) {
      const latestFiles = this.getLatestFiles(result, installation.clientType);
      if (!latestFiles.length) {
        continue;
      }

      const searchResult = this.getAddonSearchResult(result, latestFiles);
      if (searchResult) {
        searchResults.push(searchResult);
      }
    }

    return searchResults;
  }

  public async searchByUrl(addonUri: URL, installation: WowInstallation): Promise<SearchByUrlResult> {
    const slugRegex = /\/addons\/(.*?)(\/|$)/gi;
    const slugMatch = slugRegex.exec(addonUri.pathname);
    if (!slugMatch || slugMatch.length < 2) {
      return undefined;
    }
    const result = await this.searchBySlug(slugMatch[1], installation.clientType);

    return {
      errors: [],
      searchResult: result,
    };
  }

  private async searchBySlug(slug: string, clientType: WowClientType): Promise<AddonSearchResult | undefined> {
    const searchWord = _.first(slug.split("-"));
    if (!searchWord) {
      throw new Error("Invalid slug");
    }

    const response = await this.getSearchResults(searchWord, clientType);

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

  public async getCategory(category: AddonCategory, installation: WowInstallation): Promise<AddonSearchResult[]> {
    const curseCategories = this.mapAddonCategory(category);
    const gameVersionTypeId = this.getGameVersionTypeId(installation.clientType);

    const response = await this.getCategoryAddons(curseCategories[0], gameVersionTypeId, 50, 0);

    await this.removeBlockedItems(response);

    const searchResults: AddonSearchResult[] = [];
    for (const responseItem of response) {
      const latestFiles = this.getLatestFiles(responseItem, installation.clientType);
      if (!latestFiles.length) {
        continue;
      }

      const searchResult = this.getAddonSearchResult(responseItem, latestFiles);
      if (searchResult !== undefined) {
        searchResults.push(searchResult);
      }
    }

    return searchResults;
  }

  private async getSearchResults(query: string, clientType: WowClientType): Promise<CF2Addon[]> {
    const request: CF2SearchModsParams = {
      gameId: 1,
      searchFilter: query,
      gameVersionTypeId: this.getCFGameVersionType(clientType),
    };

    const client = await this.getClient();
    const response = await this._circuitBreaker.fire(() => client.searchMods(request));

    return response.data.data;
  }

  public getById(addonId: string, installation: WowInstallation): Observable<AddonSearchResult | undefined> {
    return this.getByIdBase(addonId).pipe(
      map((result) => {
        if (!result) {
          return undefined;
        }

        const latestFiles = this.getLatestFiles(result, installation.clientType);
        if (!latestFiles?.length) {
          return undefined;
        }

        return this.getAddonSearchResult(result, latestFiles);
      })
    );
  }

  private getByIdBase(addonId: string): Observable<CF2Addon | undefined> {
    return from(this.getClient()).pipe(
      switchMap((client) => {
        return from(this._circuitBreaker.fire(() => client.getMod(parseInt(addonId, 10))));
      }),
      map((response) => response.data.data),
      catchError((e) => {
        // We want to eat things like 400/500 responses
        console.error(e);
        return of(undefined);
      })
    );
  }

  private getAddonFileById(addonId: string | number, fileId: string | number): Observable<CF2File> {
    return from(this.getClient()).pipe(
      switchMap((client) =>
        from(this._circuitBreaker.fire(() => client.getModFile(parseInt(`${addonId}`, 10), parseInt(`${fileId}`, 10))))
      ),
      map((response) => response.data.data)
    );
  }

  public isValidAddonUri(addonUri: URL): boolean {
    return (
      addonUri.host !== undefined &&
      addonUri.host.endsWith("curseforge.com") &&
      addonUri.pathname.startsWith("/wow/addons")
    );
  }

  public isValidAddonId(addonId: string): boolean {
    return !!addonId && !isNaN(parseInt(addonId, 10));
  }

  private getAddonSearchResult(result: CF2Addon, latestFiles: CF2File[] = []): AddonSearchResult | undefined {
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
          gameVersion: AddonUtils.getGameVersion(this.getGameVersion(lf)),
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
        externalUrl: result.links?.websiteUrl,
        providerName: this.name,
        files: _.orderBy(searchResultFiles, (f) => f.channelType).reverse(),
        downloadCount: result.downloadCount,
        summary: result.summary,
        screenshotUrls: this.getScreenshotUrls(result),
        externallyBlocked: result.allowModDistribution === false,
      };

      return searchResult;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  private async removeBlockedItems(searchResults: CF2Addon[]) {
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

  private async isBlockedAuthor(author: CF2Author) {
    try {
      const blockList = await this._wowupApiService.getBlockList().toPromise();
      const blockedAuthorIds = blockList.curse.authors.map((author) => author.authorId);
      return blockedAuthorIds.includes(author.id.toString()) || blockedAuthorIds.includes(author.id.toString());
    } catch (e) {
      return false;
    }
  }

  private filterFeaturedAddons(results: CF2Addon[], clientType: WowClientType): CF2Addon[] {
    return results.filter((r) => r.latestFiles.some((lf) => this.isClientType(lf, clientType)));
  }

  private createAddonSearchResultDependency = (dependency: CF2FileDependency): AddonSearchResultDependency => {
    return {
      externalAddonId: dependency.modId.toString(),
      type: this.toAddonDependencyType(dependency.relationType),
    };
  };

  private toAddonDependencyType(curseDependencyType: CF2FileRelationType): AddonDependencyType {
    switch (curseDependencyType) {
      case CF2FileRelationType.EmbeddedLibrary:
        return AddonDependencyType.Embedded;
      case CF2FileRelationType.OptionalDependency:
        return AddonDependencyType.Optional;
      case CF2FileRelationType.RequiredDependency:
        return AddonDependencyType.Required;
      case CF2FileRelationType.Include:
      case CF2FileRelationType.Incompatible:
      case CF2FileRelationType.Tool:
      default:
        return AddonDependencyType.Other;
    }
  }

  private async getFeaturedAddonList(wowInstallation: WowInstallation): Promise<CF2Addon[]> {
    const client = await this.getClient();
    if (!client) {
      return [];
    }

    const gameVersionTypeId = this.getGameVersionTypeId(wowInstallation.clientType);

    const request: CF2GetFeaturedModsRequest = {
      gameId: 1,
      gameVersionTypeId,
      excludedModIds: [],
    };

    const cacheKey = `getFeaturedAddonList-${JSON.stringify(request)}`;
    const result = await this._cachingService.transaction(
      cacheKey,
      () => client.getFeaturedMods(request),
      FEATURED_ADDONS_CACHE_TTL_SEC
    );

    if (!result || result.statusCode !== 200) {
      return [];
    }

    const body = result.data;
    // Remove duplicate addons that are already in the popular list from the recents list
    const uniqueRecent = body.data.recentlyUpdated.filter((ru) => !body.data.popular.some((p) => p.id === ru.id));

    return [...body.data.popular, ...uniqueRecent];
  }

  private async getCategoryAddons(
    category: CurseAddonCategory,
    gameVersionFlavor: CF2WowGameVersionType,
    pageSize: number,
    pageNumber: number
  ): Promise<CF2Addon[]> {
    const request: CF2SearchModsParams = {
      gameId: 1,
      categoryId: category,
      pageSize: pageSize,
      index: pageNumber,
      sortOrder: "desc",
      gameVersionTypeId: gameVersionFlavor,
    };

    const cacheKey = JSON.stringify(request);

    const client = await this.getClient();
    const result = await this._cachingService.transaction(cacheKey, () =>
      this._circuitBreaker.fire(() => client.searchMods(request))
    );

    return result?.data?.data ?? [];
  }

  private getChannelType(releaseType: CF2FileReleaseType): AddonChannelType {
    switch (releaseType) {
      case CF2FileReleaseType.Alpha:
        return AddonChannelType.Alpha;
      case CF2FileReleaseType.Beta:
        return AddonChannelType.Beta;
      case CF2FileReleaseType.Release:
      default:
        return AddonChannelType.Stable;
    }
  }

  private getFolderNames(file: CF2File): string[] {
    return file.modules.map((m) => m.name);
  }

  private getGameVersion(file: CF2File): string {
    return _.first(file.gameVersions) ?? "";
  }

  private getAuthor(result: CF2Addon): string {
    const authorNames = result.authors.map((a) => a.name).filter((lf) => !lf.toLowerCase().startsWith("_forgeuser"));
    return authorNames.join(", ");
  }

  private getThumbnailUrl(result: CF2Addon): string {
    return result.logo?.thumbnailUrl ?? "";
  }

  private getScreenshotUrls(result: CF2Addon): string[] {
    return result.screenshots.map((f) => f.url).filter(Boolean);
  }

  private getLatestFiles(result: CF2Addon, clientType: WowClientType): CF2File[] {
    const filtered = result.latestFiles.filter(
      (latestFile) => latestFile.exposeAsAlternative !== true && this.isClientType(latestFile, clientType)
    );
    return _.sortBy(filtered, (latestFile) => latestFile.id).reverse();
  }

  private isClientType(file: CF2File, clientType: WowClientType) {
    return this.isCompatible(clientType, file);
  }

  private getGameVersionTypeId(clientType: WowClientType): number {
    const gameType = GAME_TYPE_LISTS.find((gtl) => gtl.matches.includes(clientType));
    if (!gameType) {
      throw new Error(`Game type not found: ${clientType}`);
    }

    return gameType.typeId;
  }

  private getGameVersionFlavor(clientType: WowClientType): CurseGameVersionFlavor {
    const gameType = GAME_TYPE_LISTS.find((gtl) => gtl.matches.includes(clientType));
    if (!gameType) {
      throw new Error(`Game type not found: ${clientType}`);
    }

    return gameType.flavor as CurseGameVersionFlavor;
  }

  private getValidClientTypes(file: CF2File): WowClientType[] {
    const gameVersions: WowClientType[] = [];

    const flavorMatches =
      GAME_TYPE_LISTS.find(
        (list) => file.sortableGameVersions.find((sgv) => sgv.gameVersionTypeId === list.typeId) !== undefined
      )?.matches ?? [];

    gameVersions.push(...flavorMatches);

    if (!Array.isArray(file.gameVersions) || file.gameVersions.length === 0) {
      return gameVersions;
    }

    return _.uniq(gameVersions);
  }

  private getWowUpChannel(releaseType: CF2FileReleaseType): AddonChannelType {
    switch (releaseType) {
      case CF2FileReleaseType.Alpha:
        return AddonChannelType.Alpha;
      case CF2FileReleaseType.Beta:
        return AddonChannelType.Beta;
      case CF2FileReleaseType.Release:
      default:
        return AddonChannelType.Stable;
    }
  }

  private isCompatible(clientType: WowClientType, file: CF2File): boolean {
    if (Array.isArray(file.sortableGameVersions) && file.sortableGameVersions.length > 0) {
      const gameVersionTypeId = this.getGameVersionTypeId(clientType);
      return this.hasSortableGameVersion(file, gameVersionTypeId);
    }

    return false;

    // flavor is deprecated by CF
    // const gameVersionFlavor = this.getGameVersionFlavor(clientType);
    // console.debug(`Checking via game version flavor fallback`, gameVersionFlavor, file.displayName);
    // return file.gameVersionFlavor === gameVersionFlavor;
  }

  private hasSortableGameVersion(file: CF2File, typeId: number): boolean {
    if (!file.sortableGameVersions) {
      console.debug(file);
    }
    return file.sortableGameVersions.find((sgv) => sgv.gameVersionTypeId === typeId) !== undefined;
  }

  private getAddon(installation: WowInstallation, scanResult: AppCurseV2ScanResult): Addon {
    if (!scanResult.exactMatch || !scanResult.searchResult) {
      throw new Error("No scan result exact match");
    }

    const currentVersion = scanResult.exactMatch.file;

    const authors = scanResult.searchResult.authors.map((author) => author.name).join(", ");

    const folders = scanResult.exactMatch.file.modules.map((module) => module.name);
    const folderList = folders.join(",");

    const latestFiles = this.getLatestFiles(scanResult.searchResult, installation.clientType);

    const targetToc = this._tocService.getTocForGameType2(scanResult.addonFolder, installation.clientType);
    if (!targetToc) {
      console.error(scanResult.addonFolder.tocs);
      throw new Error("Target toc not found");
    }

    const gameVersion = AddonUtils.getGameVersion(targetToc.interface);

    let channelType = this.getChannelType(scanResult.exactMatch.file.releaseType);
    let latestVersion = latestFiles.find((lf) => this.getChannelType(lf.releaseType) <= channelType);

    // If there were no releases that met the channel type restrictions
    if (!latestVersion && latestFiles.length > 0) {
      latestVersion = latestFiles[0];
      if (!latestVersion) {
        throw new Error("No latest version found");
      }

      channelType = this.getWowUpChannel(latestVersion.releaseType);
      console.warn("falling back to default channel");
    }

    const addon: Addon = {
      id: uuidv4(),
      author: authors,
      name: scanResult.searchResult?.name ?? "unknown",
      channelType,
      autoUpdateEnabled: false,
      autoUpdateNotificationsEnabled: false,
      clientType: installation.clientType,
      downloadUrl: latestVersion?.downloadUrl ?? scanResult.exactMatch?.file.downloadUrl ?? "",
      externalUrl: scanResult.searchResult?.links?.websiteUrl ?? "",
      externalId: scanResult.searchResult?.id.toString() ?? "",
      gameVersion: gameVersion,
      installedAt: new Date(scanResult.addonFolder?.fileStats?.birthtimeMs ?? 0),
      installedFolders: folderList,
      installedFolderList: folders,
      installedVersion: currentVersion.displayName,
      installedExternalReleaseId: currentVersion.id.toString(),
      isIgnored: false,
      latestVersion: latestVersion?.displayName ?? scanResult.exactMatch?.file.displayName ?? "",
      providerName: this.name,
      thumbnailUrl: scanResult.searchResult ? this.getThumbnailUrl(scanResult.searchResult) : "",
      screenshotUrls: scanResult.searchResult ? this.getScreenshotUrls(scanResult.searchResult) : [],
      downloadCount: scanResult.searchResult?.downloadCount ?? 0,
      summary: scanResult.searchResult?.summary ?? "",
      releasedAt: new Date(latestVersion?.fileDate ?? scanResult.exactMatch?.file.fileDate ?? ""),
      isLoadOnDemand: false,
      externalLatestReleaseId: (latestVersion?.id ?? scanResult.exactMatch?.file.id ?? "").toString(),
      updatedAt: scanResult.addonFolder?.fileStats?.birthtime ?? new Date(0),
      externalChannel: getEnumName(AddonChannelType, channelType),
      installationId: installation.id,
    };

    if (!latestFiles.length) {
      addon.warningType = AddonWarningType.NoProviderFiles;
    }

    return addon;
  }

  private mapAddonCategory(category: AddonCategory): CurseAddonCategory[] {
    switch (category) {
      case AddonCategory.Achievements:
        return [CurseAddonCategory.Achievements];
      case AddonCategory.ActionBars:
        return [CurseAddonCategory.ActionBars];
      case AddonCategory.AuctionEconomy:
        return [CurseAddonCategory.AuctionEconomy];
      case AddonCategory.BagsInventory:
        return [CurseAddonCategory.BagsInventory];
      case AddonCategory.BossEncounters:
        return [CurseAddonCategory.BossEncounters];
      case AddonCategory.BuffsDebuffs:
        return [CurseAddonCategory.BuffsDebuffs];
      case AddonCategory.ChatCommunication:
        return [CurseAddonCategory.ChatCommunication];
      case AddonCategory.Class:
        return [CurseAddonCategory.Class];
      case AddonCategory.Combat:
        return [CurseAddonCategory.Combat];
      case AddonCategory.Companions:
        return [CurseAddonCategory.Companions];
      case AddonCategory.DataExport:
        return [CurseAddonCategory.DataExport];
      case AddonCategory.DevelopmentTools:
        return [CurseAddonCategory.DevelopmentTools];
      case AddonCategory.Guild:
        return [CurseAddonCategory.Guild];
      case AddonCategory.Libraries:
        return [CurseAddonCategory.Libraries];
      case AddonCategory.Mail:
        return [CurseAddonCategory.Mail];
      case AddonCategory.MapMinimap:
        return [CurseAddonCategory.MapMinimap];
      case AddonCategory.Miscellaneous:
        return [CurseAddonCategory.Miscellaneous];
      case AddonCategory.Missions:
        return [CurseAddonCategory.Garrison];
      case AddonCategory.Plugins:
        return [CurseAddonCategory.Plugins];
      case AddonCategory.Professions:
        return [CurseAddonCategory.Professions];
      case AddonCategory.PVP:
        return [CurseAddonCategory.PvP];
      case AddonCategory.QuestsLeveling:
        return [CurseAddonCategory.QuestsLeveling];
      case AddonCategory.Roleplay:
        return [CurseAddonCategory.Roleplay];
      case AddonCategory.Tooltips:
        return [CurseAddonCategory.Tooltip];
      case AddonCategory.UnitFrames:
        return [CurseAddonCategory.UnitFrames];
      default:
        throw new Error("Unhandled addon category");
    }
  }

  private getCFGameVersionType(clientType: WowClientType): CF2WowGameVersionType {
    const clientGroup = getWowClientGroup(clientType);

    switch (clientGroup) {
      case WowClientGroup.BurningCrusade:
        return CF2WowGameVersionType.BurningCrusade;
      case WowClientGroup.Classic:
        return CF2WowGameVersionType.Classic;
      case WowClientGroup.Retail:
        return CF2WowGameVersionType.Retail;
      default:
        throw new Error(`invalid game type: ${clientGroup as string}`);
    }
  }

  private async getClient(): Promise<CFV2Client | undefined> {
    if (this._cfClient) {
      return this._cfClient;
    }

    const apiKey = await this._sensitiveStorageService.getAsync(PREF_CF2_API_KEY);
    if (typeof apiKey !== "string" || apiKey.length === 0) {
      return undefined;
    }

    this._cfClient = new CFV2Client({
      apiKey,
    });

    return this._cfClient;
  }
}
