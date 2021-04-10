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
import { CurseFolderScanResult } from "../../common/curse/curse-folder-scan-result";
import { CurseAddonCategory, CurseGameVersionFlavor } from "../../common/curse/curse-models";
import { Addon } from "../../common/entities/addon";
import { WowClientType } from "../../common/warcraft/wow-client-type";
import { AddonCategory, AddonChannelType, AddonDependencyType, AddonWarningType } from "../../common/wowup/models";
import { AppConfig } from "../../environments/environment";
import { SourceRemovedAddonError } from "../errors";
import { AppCurseScanResult } from "../models/curse/app-curse-scan-result";
import {
  CurseAddonFileResponse,
  CurseAuthor,
  CurseDependency,
  CurseDependencyType,
  CurseFile,
  CurseFingerprintsResponse,
  CurseGetFeaturedResponse,
  CurseMatch,
  CurseReleaseType,
  CurseSearchResult,
} from "../models/curse/curse-api";
import { AddonFolder } from "../models/wowup/addon-folder";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { AddonSearchResultDependency } from "../models/wowup/addon-search-result-dependency";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";
import { ProtocolSearchResult } from "../models/wowup/protocol-search-result";
import { WowInstallation } from "../models/wowup/wow-installation";
import { ElectronService } from "../services";
import { CachingService } from "../services/caching/caching-service";
import { CircuitBreakerWrapper, NetworkService } from "../services/network/network.service";
import { WowUpApiService } from "../services/wowup-api/wowup-api.service";
import * as AddonUtils from "../utils/addon.utils";
import { getEnumName } from "../utils/enum.utils";
import { AddonProvider, GetAllResult } from "./addon-provider";

const API_URL = "https://addons-ecs.forgesvc.net/api/v2";
const CHANGELOG_CACHE_TTL_SEC = 30 * 60;

interface ProtocolData {
  addonId: number;
  fileId: number;
}

export class CurseAddonProvider extends AddonProvider {
  private readonly _circuitBreaker: CircuitBreakerWrapper;

  public readonly name = ADDON_PROVIDER_CURSEFORGE;
  public readonly forceIgnore = false;
  public readonly allowReinstall = true;
  public readonly allowChannelChange = true;
  public readonly allowEdit = true;
  public enabled = true;

  public constructor(
    private _cachingService: CachingService,
    private _electronService: ElectronService,
    private _wowupApiService: WowUpApiService,
    _networkService: NetworkService
  ) {
    super();

    this._circuitBreaker = _networkService.getCircuitBreaker(`${this.name}_main`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async getDescription(installation: WowInstallation, externalId: string, addon?: Addon): Promise<string> {
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

  public isValidProtocol(protocol: string): boolean {
    return protocol.toLowerCase().startsWith("curseforge://");
  }

  public async searchProtocol(protocol: string): Promise<ProtocolSearchResult | undefined> {
    const protocolData = this.parseProtocol(protocol);
    console.debug("protocolData", protocolData);
    if (!protocolData.addonId || !protocolData.fileId) {
      throw new Error("Invalid protocol data");
    }

    const addonResult = await this.getByIdBase(protocolData.addonId.toString()).toPromise();
    console.debug("addonResult", addonResult);
    if (!addonResult) {
      throw new Error(`Failed to get addon data`);
    }

    const addonFileResponse = await this.getAddonFileById(protocolData.addonId, protocolData.fileId).toPromise();

    // const targetFile = _.find(addonResult.latestFiles, (lf) => lf.id === protocolData.fileId);
    console.debug("targetFile", addonFileResponse);
    if (!addonFileResponse) {
      throw new Error("Failed to get target file");
    }

    const searchResult: ProtocolSearchResult = {
      protocol,
      protocolAddonId: protocolData.addonId.toString(),
      protocolReleaseId: protocolData.fileId.toString(),
      validClientTypes: this.getValidClientTypes(addonFileResponse.gameVersionFlavor),
      ...this.getAddonSearchResult(addonResult, [addonFileResponse]),
    };
    console.debug("searchResult", searchResult);

    return searchResult;
  }

  private parseProtocol(protocol: string): ProtocolData {
    const url = new URL(protocol);
    return {
      addonId: +url.searchParams.get("addonId"),
      fileId: +url.searchParams.get("fileId"),
    };
  }

  public async getChangelog(
    installation: WowInstallation,
    externalId: string,
    externalReleaseId: string
  ): Promise<string> {
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

    console.time("CFScan");
    const scanResults = await this.getScanResults(addonFolders);
    console.timeEnd("CFScan");

    await this.mapAddonFolders(scanResults, installation);

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
        // If a folder did not have a match, and the folder has a CF toc id, try that
        // This can happen if the CF api is having issues returning latestFiles
        console.warn(`scan result missing for addon: ${addonFolder.name}`);
        const searchResult = await this.getByIdBase(scanResult.exactMatch.id.toString()).toPromise();
        if (searchResult) {
          addonResults.push(searchResult);
          scanResult.searchResult = searchResult;
        } else {
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

  public getScanResults = async (addonFolders: AddonFolder[]): Promise<AppCurseScanResult[]> => {
    const filePaths = addonFolders.map((addonFolder) => addonFolder.path);
    const scanResults: CurseFolderScanResult[] = await this._electronService.invoke(
      IPC_CURSE_GET_SCAN_RESULTS,
      filePaths
    );

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

  private async mapAddonFolders(scanResults: AppCurseScanResult[], installation: WowInstallation) {
    if (!installation) {
      return;
    }

    const fingerprintResponse = await this.getAddonsByFingerprintsW(scanResults.map((result) => result.fingerprint));

    for (const scanResult of scanResults) {
      // Curse can deliver the wrong result sometimes, ensure the result matches the client type
      scanResult.exactMatch = fingerprintResponse.exactMatches.find(
        (exactMatch) =>
          this.isGameVersionFlavor(exactMatch.file.gameVersionFlavor, installation.clientType) &&
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
    // console.log(`Fetching addon info ${url} ${addonIds.length}`);
    const response = await this._circuitBreaker.postJson<CurseSearchResult[]>(url, addonIds);

    await this.removeBlockedItems(response);

    return response;
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
    const addons = await this.getFeaturedAddonList();
    const filteredAddons = this.filterFeaturedAddons(addons, installation.clientType);

    await this.removeBlockedItems(filteredAddons);

    return filteredAddons.map((addon) => {
      const latestFiles = this.getLatestFiles(addon, installation.clientType);
      return this.getAddonSearchResult(addon, latestFiles);
    });
  }

  public async searchByQuery(
    query: string,
    installation: WowInstallation,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    channelType?: AddonChannelType
  ): Promise<AddonSearchResult[]> {
    const searchResults: AddonSearchResult[] = [];

    const response = await this.getSearchResults(query);

    await this.removeBlockedItems(response);

    for (const result of response) {
      const latestFiles = this.getLatestFiles(result, installation.clientType);
      if (!latestFiles.length) {
        continue;
      }

      searchResults.push(this.getAddonSearchResult(result, latestFiles));
    }

    return searchResults;
  }

  public async searchByUrl(addonUri: URL, installation: WowInstallation): Promise<AddonSearchResult> {
    const slugRegex = /\/addons\/(.*?)(\/|$)/gi;
    const slugMatch = slugRegex.exec(addonUri.pathname);
    if (!slugMatch) {
      return null;
    }
    return await this.searchBySlug(slugMatch[1], installation.clientType);
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

  public async getCategory(category: AddonCategory, installation: WowInstallation): Promise<AddonSearchResult[]> {
    const curseCategories = this.mapAddonCategory(category);
    const gameVersionFlavor = this.getGameVersionFlavor(installation.clientType);

    const response = await this.getCategoryAddons(curseCategories[0], gameVersionFlavor, 150, 0);
    const searchResults: AddonSearchResult[] = [];
    for (const responseItem of response) {
      const latestFiles = this.getLatestFiles(responseItem, installation.clientType);
      if (!latestFiles.length) {
        continue;
      }

      searchResults.push(this.getAddonSearchResult(responseItem, latestFiles));
    }

    return searchResults;
  }

  private async getSearchResults(query: string): Promise<CurseSearchResult[]> {
    const url = new URL(`${API_URL}/addon/search`);
    url.searchParams.set("gameId", "1");
    url.searchParams.set("searchFilter", query);

    return await this._circuitBreaker.getJson<CurseSearchResult[]>(url);
  }

  public getById(addonId: string, installation: WowInstallation): Observable<AddonSearchResult> {
    return this.getByIdBase(addonId).pipe(
      map((result) => {
        if (!result) {
          return null;
        }

        const latestFiles = this.getLatestFiles(result, installation.clientType);
        if (!latestFiles?.length) {
          return null;
        }

        return this.getAddonSearchResult(result, latestFiles);
      })
    );
  }

  private getByIdBase(addonId: string): Observable<CurseSearchResult> {
    const url = `${API_URL}/addon/${addonId}`;

    return from(this._circuitBreaker.getJson<CurseSearchResult>(url));
  }

  private getAddonFileById(addonId: string | number, fileId: string | number): Observable<CurseAddonFileResponse> {
    const url = `${API_URL}/addon/${addonId}/file/${fileId}`;

    return from(this._circuitBreaker.getJson<CurseAddonFileResponse>(url));
  }

  public isValidAddonUri(addonUri: URL): boolean {
    return addonUri.host && addonUri.host.endsWith("curseforge.com") && addonUri.pathname.startsWith("/wow/addons");
  }

  public isValidAddonId(addonId: string): boolean {
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

  private async getCategoryAddons(
    category: CurseAddonCategory,
    gameVersionFlavor: CurseGameVersionFlavor,
    pageSize: number,
    pageNumber: number
  ): Promise<CurseSearchResult[]> {
    //https://addons-ecs.forgesvc.net/api/v2/addon/search?gameId=1&categoryId=1018&pageSize=20&index=0&sort=1&sortDescending=true&gameVersionFlavor=wow_retail
    const url = new URL(`${API_URL}/addon/search`);
    url.searchParams.set("gameId", "1");
    url.searchParams.set("categoryId", category.toString());
    url.searchParams.set("pageSize", pageSize.toString());
    url.searchParams.set("index", pageNumber.toString());
    url.searchParams.set("sort", "1");
    url.searchParams.set("sortDescending", "true");
    url.searchParams.set("gameVersionFlavor", gameVersionFlavor);

    const urlStr = url.toString();
    const result = await this._cachingService.transaction(urlStr, () =>
      this._circuitBreaker.getJson<CurseSearchResult[]>(urlStr)
    );

    return result ? result : [];
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

  private getGameVersionFlavor(clientType: WowClientType): CurseGameVersionFlavor {
    switch (clientType) {
      case WowClientType.Classic:
      case WowClientType.ClassicPtr:
        return "wow_classic";
      case WowClientType.ClassicBeta:
        return "wow_burning_crusade";
      case WowClientType.Retail:
      case WowClientType.RetailPtr:
      case WowClientType.Beta:
      default:
        return "wow_retail";
    }
  }

  private getValidClientTypes(gameVersionFlavor: string): WowClientType[] {
    switch (gameVersionFlavor) {
      case "wow_classic":
        return [WowClientType.Classic, WowClientType.ClassicPtr, WowClientType.ClassicBeta];
      default:
        return [WowClientType.Retail, WowClientType.RetailPtr, WowClientType.Beta];
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

  private getAddon(installation: WowInstallation, scanResult: AppCurseScanResult): Addon {
    const currentVersion = scanResult.exactMatch.file;

    const authors = scanResult.searchResult.authors.map((author) => author.name).join(", ");

    const folders = scanResult.exactMatch.file.modules.map((module) => module.foldername);
    const folderList = folders.join(",");

    const latestFiles = this.getLatestFiles(scanResult.searchResult, installation.clientType);

    const gameVersion = AddonUtils.getGameVersion(
      currentVersion.gameVersion[0] || scanResult.addonFolder.toc.interface
    );

    let channelType = this.getChannelType(scanResult.exactMatch.file.releaseType);
    let latestVersion = latestFiles.find((lf) => this.getChannelType(lf.releaseType) <= channelType);

    // If there were no releases that met the channel type restrictions
    if (!latestVersion && latestFiles.length > 0) {
      latestVersion = _.first(latestFiles);
      channelType = this.getWowUpChannel(latestVersion.releaseType);
      console.warn("falling back to default channel");
    }

    const addon: Addon = {
      id: uuidv4(),
      author: authors,
      name: scanResult.searchResult.name,
      channelType,
      autoUpdateEnabled: false,
      clientType: installation.clientType,
      downloadUrl: latestVersion?.downloadUrl ?? scanResult.exactMatch.file.downloadUrl,
      externalUrl: scanResult.searchResult.websiteUrl,
      externalId: scanResult.searchResult.id.toString(),
      gameVersion: gameVersion,
      installedAt: new Date(scanResult.addonFolder.fileStats.birthtimeMs),
      installedFolders: folderList,
      installedFolderList: folders,
      installedVersion: currentVersion.displayName,
      installedExternalReleaseId: currentVersion.id.toString(),
      isIgnored: false,
      latestVersion: latestVersion?.displayName ?? scanResult.exactMatch.file.displayName,
      providerName: this.name,
      thumbnailUrl: this.getThumbnailUrl(scanResult.searchResult),
      screenshotUrls: this.getScreenshotUrls(scanResult.searchResult),
      downloadCount: scanResult.searchResult.downloadCount,
      summary: scanResult.searchResult.summary,
      releasedAt: new Date(latestVersion?.fileDate ?? scanResult.exactMatch.file.fileDate),
      isLoadOnDemand: false,
      externalLatestReleaseId: (latestVersion?.id ?? scanResult.exactMatch.file.id).toString(),
      updatedAt: scanResult.addonFolder.fileStats.birthtime,
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
}
