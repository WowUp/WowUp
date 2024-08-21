import * as cfv2 from "curseforge-v2";
import * as _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import {
  Addon,
  AddonCategory,
  AddonChannelType,
  AddonDependencyType,
  AddonFolder,
  AddonProvider,
  AddonScanResult,
  AddonSearchResult,
  AddonSearchResultDependency,
  AddonSearchResultFile,
  AddonWarningType,
  AdPageOptions,
  GetAllBatchResult,
  GetAllResult,
  getEnumName,
  getGameVersion,
  getGameVersionList,
  getWowClientGroupForType,
  ProtocolSearchResult,
  SearchByUrlResult,
  SourceRemovedAddonError,
  WowClientGroup,
  WowClientType,
  WowInstallation,
} from "wowup-lib-core";

import {
  ADDON_PROVIDER_CURSEFORGE,
  NO_LATEST_SEARCH_RESULT_FILES_ERROR,
  NO_SEARCH_RESULTS_ERROR,
} from "../../common/constants";
import { AppConfig } from "../../environments/environment";
import { CachingService } from "../services/caching/caching-service";
import { CircuitBreakerWrapper, NetworkService } from "../services/network/network.service";
import { TocService } from "../services/toc/toc.service";
import { strictFilter } from "../utils/array.utils";
import { TocNotFoundError } from "../errors";

interface ProtocolData {
  addonId: number;
  fileId: number;
}

interface ScanMatchPair {
  addonFolder: AddonFolder;
  match: cfv2.CF2FingerprintMatch;
  addon?: cfv2.CF2Addon;
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
    flavor: "wow-wrath-classic",
    typeId: 73713,
    matches: [],
  },
  {
    flavor: "wow_retail",
    typeId: 517,
    matches: [WowClientType.Retail, WowClientType.RetailPtr, WowClientType.Beta, WowClientType.RetailXPtr],
  },
  {
    flavor: "wow-cataclysm-classic",
    typeId: 77522,
    matches: [WowClientType.Classic, WowClientType.ClassicPtr, WowClientType.ClassicBeta],
  },
];

export class CurseAddonProvider extends AddonProvider {
  private readonly _circuitBreaker: CircuitBreakerWrapper;
  private readonly _cf2Client: cfv2.CFV2Client;

  public readonly name = ADDON_PROVIDER_CURSEFORGE;
  public readonly forceIgnore = false;
  public readonly allowChannelChange = true;
  public readonly allowReinstall = true;
  public readonly canBatchFetch = true;
  public readonly allowEdit = true;

  public adRequired = true;
  public enabled = true;

  public constructor(
    private _cachingService: CachingService,
    private _networkService: NetworkService,
    private _tocService: TocService,
  ) {
    super();

    this._circuitBreaker = this._networkService.getCircuitBreaker(
      `${this.name}_main`,
      undefined,
      AppConfig.curseforge.httpTimeoutMs,
    );

    this._cf2Client = new cfv2.CFV2Client({
      apiKey: AppConfig.curseforge.apiKey,
    });
  }

  public override async getAllBatch(installations: WowInstallation[], addonIds: string[]): Promise<GetAllBatchResult> {
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
        (addonId) => _.find(searchResults, (sr) => sr.id.toString() === addonId) === undefined,
      );

      batchResult.errors[installation.id] = _.map(
        missingAddonIds,
        (addonId) => new SourceRemovedAddonError(addonId, undefined),
      );

      batchResult.installationResults[installation.id] = addonResults;
    }

    return batchResult;
  }

  public override async getAll(installation: WowInstallation, addonIds: string[]): Promise<GetAllResult> {
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
      (addonId) => _.find(searchResults, (sr) => sr.id.toString() === addonId) === undefined,
    );

    const deletedErrors = _.map(missingAddonIds, (addonId) => new SourceRemovedAddonError(addonId, undefined));

    return {
      errors: [...deletedErrors],
      searchResults: addonResults,
    };
  }

  public override async getFeaturedAddons(installation: WowInstallation): Promise<AddonSearchResult[]> {
    const addons = await this.getFeaturedAddonList(installation);
    const filteredAddons = this.filterFeaturedAddons(addons, installation.clientType);

    const mapped = filteredAddons.map((addon) => {
      const latestFiles = this.getLatestFiles(addon, installation.clientType);
      return this.getAddonSearchResult(addon, latestFiles);
    });

    return strictFilter(mapped);
  }

  public override shouldMigrate(addon: Addon): boolean {
    return !addon.installedExternalReleaseId;
  }

  public override async searchByQuery(
    query: string,
    installation: WowInstallation,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    channelType?: AddonChannelType,
  ): Promise<AddonSearchResult[]> {
    const searchResults: AddonSearchResult[] = [];

    const response = await this.getSearchResults(query, installation.clientType);

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

  public override async searchByUrl(
    addonUri: URL,
    installation: WowInstallation,
  ): Promise<SearchByUrlResult | undefined> {
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

  public override async searchProtocol(protocol: string): Promise<ProtocolSearchResult | undefined> {
    const protocolData = this.parseProtocol(protocol);
    if (!protocolData.addonId || !protocolData.fileId) {
      throw new Error("Invalid protocol data");
    }

    const addonResult = await this.getByIdBase(protocolData.addonId.toString());
    if (!addonResult) {
      throw new Error(`Failed to get addon data: ${protocolData.addonId}`);
    }

    console.debug("addonResult", addonResult);

    const addonFileResponse = await this.getAddonFileById(protocolData.addonId, protocolData.fileId);
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

  public override async getCategory(
    category: AddonCategory,
    installation: WowInstallation,
  ): Promise<AddonSearchResult[]> {
    const curseCategories = this.mapAddonCategory(category);
    const gameVersionTypeId = this.getGameVersionTypeId(installation.clientType);

    const response = await this.getCategoryAddons(curseCategories[0], gameVersionTypeId, 50, 0);

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

  public override async getById(
    addonId: string,
    installation: WowInstallation,
  ): Promise<AddonSearchResult | undefined> {
    const result = await this.getByIdBase(addonId);

    if (!result) {
      return undefined;
    }

    const latestFiles = this.getLatestFiles(result, installation.clientType);
    if (!latestFiles?.length) {
      return undefined;
    }

    return this.getAddonSearchResult(result, latestFiles);
  }

  public override isValidAddonUri(addonUri: URL): boolean {
    return (
      addonUri.host !== undefined &&
      addonUri.host.endsWith("curseforge.com") &&
      addonUri.pathname.startsWith("/wow/addons")
    );
  }

  public override isValidAddonId(addonId: string): boolean {
    return !!addonId && !isNaN(parseInt(addonId, 10));
  }

  public override isValidProtocol(protocol: string): boolean {
    return protocol.toLowerCase().startsWith("curseforge://");
  }

  public override async scan(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[],
  ): Promise<void> {
    if (!addonFolders.length) {
      return;
    }

    const scanResults = addonFolders
      .map((af) => af.cfScanResults)
      .filter((sr): sr is AddonScanResult => sr !== undefined);

    const fingerprints = scanResults.map((sr) => sr.fingerprintNum);

    const result = await this._cf2Client.getFingerprintMatches({ fingerprints });
    const fingerprintData = result.data?.data;
    try {
      const matchPairs: ScanMatchPair[] = [];
      for (const af of addonFolders) {
        let exactMatch = fingerprintData?.exactMatches.find(
          (em) =>
            this.isCfFileCompatible(installation.clientType, em.file) &&
            em.file.modules.some((m) => m.fingerprint == af.cfScanResults?.fingerprintNum),
        );

        // If the addon does not have an exact match, check the partial matches.
        if (!exactMatch && Array.isArray(fingerprintData?.partialMatches) && fingerprintData !== undefined) {
          exactMatch = fingerprintData.partialMatches.find((partialMatch) =>
            partialMatch.file?.modules?.some((module) => module.fingerprint === af.cfScanResults?.fingerprintNum),
          );
        }

        if (exactMatch) {
          matchPairs.push({
            addonFolder: af,
            match: exactMatch,
          });
        }
      }

      const addonIds = matchPairs.map((mp) => mp.match.id);
      const getAddonsResult = await this._cf2Client.getMods({ modIds: addonIds });
      const addonResultData = getAddonsResult.data?.data;

      const potentialChildren: ScanMatchPair[] = [];
      matchPairs.forEach((mp) => {
        const cfAddon = addonResultData?.find((ar) => ar.id === mp.match.id);
        if (!cfAddon) {
          return;
        }

        try {
          mp.addonFolder.matchingAddon = this.createAddon(installation, mp.addonFolder, mp.match.file, cfAddon);
        } catch (e) {
          if (e instanceof TocNotFoundError) {
            potentialChildren.push(mp);
          } else {
            console.error(e);
          }
        }
      });

      potentialChildren.forEach((pc) => {
        const parent = matchPairs.find(
          (mp) => mp.addonFolder.matchingAddon !== undefined && this.isChildAddon(mp.match.file, pc.addonFolder.name),
        );
        pc.addonFolder.matchingAddon = parent?.addonFolder.matchingAddon;
      });
    } catch (e) {
      console.error("failed to process fingerprint response");
      console.error(e);
      console.log(result);
      throw e;
    }
  }

  private isChildAddon(cfAddon: cfv2.CF2File, addonName: string) {
    return cfAddon.modules.some((m) => m.name == addonName);
  }

  public override async getChangelog(
    installation: WowInstallation,
    externalId: string,
    externalReleaseId: string,
  ): Promise<string> {
    try {
      const cacheKey = `${this.name}_changelog_${externalId}_${externalReleaseId}`;

      const response = await this._cachingService.transaction(
        cacheKey,
        () => {
          return this._cf2Client.getModFileChangelog(parseInt(externalId, 10), parseInt(externalReleaseId, 10));
        },
        CHANGELOG_CACHE_TTL_SEC,
      );

      return response.data?.data || "";
    } catch (e) {
      console.error("Failed to get changelog", e);
    }

    return "";
  }

  public override async getDescription(installation: WowInstallation, externalId: string): Promise<string> {
    try {
      const cacheKey = `${this.name}_description_${externalId}`;
      const response = await this._cachingService.transaction(
        cacheKey,
        () => {
          return this._cf2Client.getModDescription(parseInt(externalId, 10));
        },
        CHANGELOG_CACHE_TTL_SEC,
      );

      if (response.data) {
        return this.standardizeDescription(response.data.data);
      }
    } catch (e) {
      console.error("Failed to get changelog", e);
    }

    return "";
  }

  public override getAdPageParams(): AdPageOptions {
    return {
      pageUrl: "",
    };
  }

  private isCfFileCompatible(clientType: WowClientType, file: cfv2.CF2File): boolean {
    if (Array.isArray(file.sortableGameVersions) && file.sortableGameVersions.length > 0) {
      const gameVersionTypeId = this.getGameVersionTypeId(clientType);
      return this.hasSortableGameVersion(file, gameVersionTypeId);
    }

    return false;
  }

  private getGameVersionTypeId(clientType: WowClientType): number {
    const gameType = GAME_TYPE_LISTS.find((gtl) => gtl.matches.includes(clientType));
    if (!gameType) {
      throw new Error(`Game type not found: ${clientType}`);
    }

    return gameType.typeId;
  }

  private hasSortableGameVersion(file: cfv2.CF2File, typeId: number): boolean {
    if (!file?.sortableGameVersions) {
      console.debug("sortableGameVersions missing", file);
    }
    return file.sortableGameVersions.some((sgv) => sgv.gameVersionTypeId === typeId);
  }

  private getThumbnailUrl(result: cfv2.CF2Addon): string {
    return result.logo?.thumbnailUrl ?? "";
  }

  private getScreenshotUrls(result: cfv2.CF2Addon): string[] {
    return result.screenshots.map((f) => f.url).filter(Boolean);
  }

  private createAddon(
    installation: WowInstallation,
    addonFolder: AddonFolder,
    cfFile: cfv2.CF2File,
    cfAddon: cfv2.CF2Addon,
  ): Addon {
    const authors = cfAddon.authors.map((author) => author.name).join(", ");
    const folders = cfFile.modules.map((module) => module.name);
    const folderList = folders.join(",");
    const latestFiles = this.getLatestFiles(cfAddon, installation.clientType);

    const channelType = this.getChannelType(cfFile.releaseType);
    const latestVersion = latestFiles.find((lf) => this.getChannelType(lf.releaseType) <= channelType);

    const targetToc = this._tocService.getTocForGameType2(addonFolder.name, addonFolder.tocs, installation.clientType);
    if (!targetToc) {
      console.error('targetToc undefined', cfAddon.name, addonFolder.tocs);
      throw new TocNotFoundError("Target toc not found");
    }

    const gameVersions = getGameVersionList(targetToc.interface);

    const addon: Addon = {
      id: uuidv4(),
      author: authors,
      name: cfAddon?.name ?? "unknown",
      channelType,
      autoUpdateEnabled: false,
      autoUpdateNotificationsEnabled: false,
      clientType: installation.clientType,
      downloadUrl: latestVersion?.downloadUrl ?? cfFile.downloadUrl ?? "",
      externalUrl: cfAddon?.links?.websiteUrl ?? "",
      externalId: cfAddon?.id.toString() ?? "",
      gameVersion: gameVersions,
      installedAt: new Date(addonFolder?.fileStats?.birthtimeMs ?? 0),
      installedFolders: folderList,
      installedFolderList: folders,
      installedVersion: cfFile.displayName,
      installedExternalReleaseId: cfFile.id.toString(),
      isIgnored: false,
      latestVersion: latestVersion?.displayName ?? cfFile.displayName ?? "",
      providerName: this.name,
      thumbnailUrl: cfAddon ? this.getThumbnailUrl(cfAddon) : "",
      screenshotUrls: cfAddon ? this.getScreenshotUrls(cfAddon) : [],
      downloadCount: cfAddon?.downloadCount ?? 0,
      summary: cfAddon?.summary ?? "",
      releasedAt: new Date(latestVersion?.fileDate ?? cfFile.fileDate ?? ""),
      isLoadOnDemand: false,
      externalLatestReleaseId: (latestVersion?.id ?? cfFile.id ?? "").toString(),
      updatedAt: addonFolder?.fileStats?.birthtime ?? new Date(0),
      externalChannel: getEnumName(AddonChannelType, channelType),
      installationId: installation.id,
    };

    if (!latestFiles.length) {
      addon.warningType = AddonWarningType.NoProviderFiles;
    }

    return addon;
  }

  private getLatestFiles(result: cfv2.CF2Addon, clientType: WowClientType): cfv2.CF2File[] {
    const filtered = result.latestFiles.filter(
      (latestFile) => latestFile.exposeAsAlternative !== true && this.isClientType(latestFile, clientType),
    );
    return _.sortBy(filtered, (latestFile) => latestFile.id).reverse();
  }

  private isClientType(file: cfv2.CF2File, clientType: WowClientType) {
    return this.isCfFileCompatible(clientType, file);
  }

  private getChannelType(releaseType: cfv2.CF2FileReleaseType): AddonChannelType {
    switch (releaseType) {
      case cfv2.CF2FileReleaseType.Alpha:
        return AddonChannelType.Alpha;
      case cfv2.CF2FileReleaseType.Beta:
        return AddonChannelType.Beta;
      case cfv2.CF2FileReleaseType.Release:
      default:
        return AddonChannelType.Stable;
    }
  }

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

  private parseProtocol(protocol: string): ProtocolData {
    const url = new URL(protocol);
    return {
      addonId: +(url.searchParams.get("addonId") ?? ""),
      fileId: +(url.searchParams.get("fileId") ?? ""),
    };
  }

  private async getAddonFileById(addonId: string | number, fileId: string | number): Promise<cfv2.CF2File | undefined> {
    const response = await this._circuitBreaker.fire(() =>
      this._cf2Client.getModFile(parseInt(`${addonId}`, 10), parseInt(`${fileId}`, 10)),
    );

    return response.data?.data;
  }

  private async getByIdBase(addonId: string): Promise<cfv2.CF2Addon | undefined> {
    try {
      const response = await this._circuitBreaker.fire(() => this._cf2Client.getMod(parseInt(addonId, 10)));
      return response.data?.data;
    } catch (e) {
      // We want to eat things like 400/500 responses
      console.error(e);
    }
  }

  private getAuthor(result: cfv2.CF2Addon): string {
    const authorNames = result.authors.map((a) => a.name).filter((lf) => !lf.toLowerCase().startsWith("_forgeuser"));
    return authorNames.join(", ");
  }

  private getFolderNames(file: cfv2.CF2File): string[] {
    return file.modules.map((m) => m.name);
  }

  private getGameVersion(file: cfv2.CF2File): string {
    return _.first(file.gameVersions) ?? "";
  }

  private createAddonSearchResultDependency = (dependency: cfv2.CF2FileDependency): AddonSearchResultDependency => {
    return {
      externalAddonId: dependency.modId.toString(),
      type: this.toAddonDependencyType(dependency.relationType),
    };
  };

  private toAddonDependencyType(curseDependencyType: cfv2.CF2FileRelationType): AddonDependencyType {
    switch (curseDependencyType) {
      case cfv2.CF2FileRelationType.EmbeddedLibrary:
        return AddonDependencyType.Embedded;
      case cfv2.CF2FileRelationType.OptionalDependency:
        return AddonDependencyType.Optional;
      case cfv2.CF2FileRelationType.RequiredDependency:
        return AddonDependencyType.Required;
      case cfv2.CF2FileRelationType.Include:
      case cfv2.CF2FileRelationType.Incompatible:
      case cfv2.CF2FileRelationType.Tool:
      default:
        return AddonDependencyType.Other;
    }
  }

  private getCFGameVersionType(clientType: WowClientType): cfv2.CF2WowGameVersionType {
    const clientGroup = getWowClientGroupForType(clientType);

    switch (clientGroup) {
      case WowClientGroup.Cata:
        return cfv2.CF2WowGameVersionType.Cata;
      case WowClientGroup.WOTLK:
        return cfv2.CF2WowGameVersionType.WOTLK;
      case WowClientGroup.BurningCrusade:
        return cfv2.CF2WowGameVersionType.BurningCrusade;
      case WowClientGroup.Classic:
        return cfv2.CF2WowGameVersionType.Classic;
      case WowClientGroup.Retail:
        return cfv2.CF2WowGameVersionType.Retail;
      default:
        throw new Error(`invalid game type: ${clientGroup as string}`);
    }
  }

  private mapAddonCategory(category: AddonCategory): cfv2.CF2WowAddonCategory[] {
    switch (category) {
      case AddonCategory.Achievements:
        return [cfv2.CF2WowAddonCategory.Achievements];
      case AddonCategory.ActionBars:
        return [cfv2.CF2WowAddonCategory.ActionBars];
      case AddonCategory.AuctionEconomy:
        return [cfv2.CF2WowAddonCategory.AuctionEconomy];
      case AddonCategory.BagsInventory:
        return [cfv2.CF2WowAddonCategory.BagsInventory];
      case AddonCategory.BossEncounters:
        return [cfv2.CF2WowAddonCategory.BossEncounters];
      case AddonCategory.BuffsDebuffs:
        return [cfv2.CF2WowAddonCategory.BuffsDebuffs];
      case AddonCategory.ChatCommunication:
        return [cfv2.CF2WowAddonCategory.ChatCommunication];
      case AddonCategory.Class:
        return [cfv2.CF2WowAddonCategory.Class];
      case AddonCategory.Combat:
        return [cfv2.CF2WowAddonCategory.Combat];
      case AddonCategory.Companions:
        return [cfv2.CF2WowAddonCategory.Companions];
      case AddonCategory.DataExport:
        return [cfv2.CF2WowAddonCategory.DataExport];
      case AddonCategory.DevelopmentTools:
        return [cfv2.CF2WowAddonCategory.DevelopmentTools];
      case AddonCategory.Guild:
        return [cfv2.CF2WowAddonCategory.Guild];
      case AddonCategory.Libraries:
        return [cfv2.CF2WowAddonCategory.Libraries];
      case AddonCategory.Mail:
        return [cfv2.CF2WowAddonCategory.Mail];
      case AddonCategory.MapMinimap:
        return [cfv2.CF2WowAddonCategory.MapMinimap];
      case AddonCategory.Miscellaneous:
        return [cfv2.CF2WowAddonCategory.Miscellaneous];
      case AddonCategory.Missions:
        return [cfv2.CF2WowAddonCategory.Garrison];
      case AddonCategory.Plugins:
        return [cfv2.CF2WowAddonCategory.Plugins];
      case AddonCategory.Professions:
        return [cfv2.CF2WowAddonCategory.Professions];
      case AddonCategory.PVP:
        return [cfv2.CF2WowAddonCategory.PvP];
      case AddonCategory.QuestsLeveling:
        return [cfv2.CF2WowAddonCategory.QuestsLeveling];
      case AddonCategory.Roleplay:
        return [cfv2.CF2WowAddonCategory.Roleplay];
      case AddonCategory.Tooltips:
        return [cfv2.CF2WowAddonCategory.Tooltip];
      case AddonCategory.UnitFrames:
        return [cfv2.CF2WowAddonCategory.UnitFrames];
      default:
        throw new Error("Unhandled addon category");
    }
  }

  private getAddonSearchResult(result: cfv2.CF2Addon, latestFiles: cfv2.CF2File[] = []): AddonSearchResult | undefined {
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
          gameVersion: getGameVersion(this.getGameVersion(lf)),
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
        externallyBlocked: false,
      };

      return searchResult;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  private getValidClientTypes(file: cfv2.CF2File): WowClientType[] {
    const gameVersions: WowClientType[] = _.flatten(
      GAME_TYPE_LISTS.filter((type) =>
        file.sortableGameVersions.find((sgv) => sgv.gameVersionTypeId === type.typeId),
      ).map((game) => game.matches),
    );

    return _.uniq(gameVersions);
  }

  private async getAllIds(addonIds: number[]): Promise<cfv2.CF2Addon[]> {
    if (!addonIds?.length) {
      return [];
    }

    const request: cfv2.CF2GetModsRequest = {
      modIds: addonIds,
    };

    const response = await this._circuitBreaker.fire(() => this._cf2Client.getMods(request));

    return response.data?.data || [];
  }

  private async getFeaturedAddonList(wowInstallation: WowInstallation): Promise<cfv2.CF2Addon[]> {
    const gameVersionTypeId = this.getGameVersionTypeId(wowInstallation.clientType);

    const request: cfv2.CF2GetFeaturedModsRequest = {
      gameId: 1,
      gameVersionTypeId,
      excludedModIds: [],
    };

    const cacheKey = `getFeaturedAddonList-${JSON.stringify(request)}`;
    const result = await this._cachingService.transaction(
      cacheKey,
      () => this._cf2Client.getFeaturedMods(request),
      FEATURED_ADDONS_CACHE_TTL_SEC,
    );

    if (!result || result.statusCode !== 200) {
      return [];
    }

    const body = result.data?.data;
    if (body) {
      // Remove duplicate addons that are already in the popular list from the recents list
      const uniqueRecent = body.recentlyUpdated.filter((ru) => !body.popular.some((p) => p.id === ru.id));

      return [...body.popular, ...uniqueRecent];
    }
    return [];
  }

  private filterFeaturedAddons(results: cfv2.CF2Addon[], clientType: WowClientType): cfv2.CF2Addon[] {
    return results.filter((r) => r.latestFiles.some((lf) => this.isClientType(lf, clientType)));
  }

  private async getSearchResults(query: string, clientType: WowClientType): Promise<cfv2.CF2Addon[]> {
    const request: cfv2.CF2SearchModsParams = {
      gameId: 1,
      categoryId: 0,
      searchFilter: query,
      sortField: 2,
      sortOrder: "desc",
      index: 0,
      gameVersionTypeId: this.getCFGameVersionType(clientType),
    };

    const response = await this._circuitBreaker.fire(() => this._cf2Client.searchMods(request));

    return response.data?.data || [];
  }

  private async searchBySlug(slug: string, clientType: WowClientType): Promise<AddonSearchResult | undefined> {
    const searchWord = _.first(slug.split("-"));
    if (!searchWord) {
      throw new Error("Invalid slug");
    }

    const response = await this.getSearchResults(searchWord, clientType);

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

  private async getCategoryAddons(
    category: cfv2.CF2WowAddonCategory,
    gameVersionFlavor: cfv2.CF2WowGameVersionType,
    pageSize: number,
    pageNumber: number,
  ): Promise<cfv2.CF2Addon[]> {
    const request: cfv2.CF2SearchModsParams = {
      gameId: 1,
      categoryId: category,
      pageSize: pageSize,
      index: pageNumber,
      sortOrder: "desc",
      gameVersionTypeId: gameVersionFlavor,
    };

    const cacheKey = JSON.stringify(request);

    const result = await this._cachingService.transaction(cacheKey, () =>
      this._circuitBreaker.fire(() => this._cf2Client.searchMods(request)),
    );

    return result?.data?.data ?? [];
  }
}
