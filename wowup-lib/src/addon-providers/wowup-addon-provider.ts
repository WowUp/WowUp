import { filter, first, flatMap, flatten, map, sortBy, uniq, find } from 'lodash';
import { v4 as uuidv4 } from 'uuid';

import { AddonProvider, GetAllBatchResult, GetAllResult } from '../addon-provider';
import {
  Addon,
  AddonFolder,
  AddonScanResult,
  AddonSearchResult,
  AddonSearchResultFile,
  ProtocolSearchResult,
} from '../addons';
import { ADDON_PROVIDER_HUB } from '../constants';
import { SourceRemovedAddonError } from '../errors';
import { WowInstallation } from '../models';
import {
  AddonReleaseGameVersion,
  GetAddonsByFingerprintResponse,
  GetFeaturedAddonsResponse,
  WowUpAddonReleaseRepresentation,
  WowUpAddonRepresentation,
  WowUpGetAddonReleaseResponse,
  WowUpGetAddonResponse,
  WowUpGetAddonsResponse,
  WowUpSearchAddonsResponse,
} from '../models/wowup';
import { AddonCategory, AddonChannelType, WowGameType } from '../types';
import { getEnumName, getGameVersion, getGameVersionList, NetworkInterface } from '../utils';
import { getWowClientGroup, getWowGameType } from '../utils/wow-client.utils';

interface WowUpScanResult {
  scanResult?: AddonScanResult;
  exactMatch?: WowUpAddonRepresentation;
}

interface GetAddonBatchResponse {
  addons: WowUpAddonRepresentation[];
}

interface ProtocolData {
  addonId: string;
  releaseId: string;
}

export class WowUpAddonProvider extends AddonProvider {
  public readonly name = ADDON_PROVIDER_HUB;
  public readonly forceIgnore = false;
  public readonly allowReinstall = true;
  public readonly allowChannelChange = true;
  public readonly allowEdit = true;
  public readonly canBatchFetch = true;
  public enabled = true;

  public constructor(
    private _baseUrl: string,
    private _websiteUrl: string,
    private _networkInterface: NetworkInterface,
  ) {
    super();
  }
  public override async scan(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[],
  ): Promise<void> {
    const gameType = getWowGameType(installation.clientType);

    const scanResults: WowUpScanResult[] = filter(addonFolders, (af) => af.wowUpScanResults !== undefined).map((af) => {
      const wuSr: WowUpScanResult = {
        scanResult: af.wowUpScanResults,
      };
      return wuSr;
    });

    const fingerprints: string[] = map(scanResults, (res) => res.scanResult?.fingerprint).filter(
      (fp): fp is string => typeof fp === 'string',
    );

    const fingerprintResponse = await this.getAddonsByFingerprints(fingerprints);

    for (const wuScanResult of scanResults) {
      const fingerprintMatches = fingerprintResponse.exactMatches.filter((exactMatch) =>
        this.hasMatchingFingerprint(wuScanResult, exactMatch.matched_release),
      );

      let clientMatch = fingerprintMatches.find((exactMatch) => this.hasGameType(exactMatch.matched_release, gameType));

      if (!clientMatch && fingerprintMatches.length > 0) {
        console.warn(`No matching client type found for ${wuScanResult.scanResult?.folderName}, using fallback`);
        clientMatch = fingerprintMatches[0];
      }

      wuScanResult.exactMatch = clientMatch;
    }

    for (const addonFolder of addonFolders) {
      const scanResult = scanResults.find((sr) => sr.scanResult?.path === addonFolder.path);
      if (scanResult === undefined || scanResult.exactMatch === undefined) {
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

  public override async getDescription(installation: WowInstallation, externalId: string): Promise<string> {
    try {
      const response = await this.getAddonById(externalId);
      return response.addon?.description ?? '';
    } catch (e) {
      console.error('Failed to get description', e);
    }
    return '';
  }

  public override shouldMigrate(addon: Addon): boolean {
    return !addon.installedExternalReleaseId;
  }

  public override isValidProtocol(protocol: string): boolean {
    return protocol.toLowerCase().startsWith(`wowup://`);
  }

  public override async searchProtocol(protocol: string): Promise<ProtocolSearchResult | undefined> {
    const protocolData = this.parseProtocol(protocol);
    if (!protocolData.addonId || !protocolData.releaseId) {
      throw new Error('Invalid protocol data');
    }

    const addonResult = await this.getAddonById(protocolData.addonId);
    if (!addonResult) {
      throw new Error(`Failed to get addon data: ${protocolData.addonId}`);
    }

    const addonFileResponse = await this.getReleaseById(protocolData.addonId, protocolData.releaseId);
    if (!addonFileResponse) {
      throw new Error('Failed to get target file');
    }

    const addonSearchResult = this.getSearchResultWithReleases(addonResult.addon, [addonFileResponse.release]);
    if (!addonSearchResult) {
      throw new Error('Addon search result not created');
    }

    const searchResult: ProtocolSearchResult = {
      protocol,
      protocolAddonId: protocolData.addonId.toString(),
      protocolReleaseId: protocolData.releaseId.toString(),
      validClientGroups: map(addonFileResponse.release.game_versions, (gv) => getWowClientGroup(gv.game_type)),
      ...addonSearchResult,
    };

    return searchResult;
  }

  public override async getAllBatch(installations: WowInstallation[], addonIds: string[]): Promise<GetAllBatchResult> {
    const batchResult: GetAllBatchResult = {
      errors: {},
      installationResults: {},
    };

    if (!addonIds.length) {
      return batchResult;
    }

    const url = new URL(`${this._baseUrl}/addons/batch`);
    const addonIdList = map(addonIds, (id) => parseInt(id, 10));
    const response = await this._networkInterface.postJson<GetAddonBatchResponse>(url, {
      body: {
        addonIds: addonIdList,
      },
      cache: true,
    });

    for (const installation of installations) {
      const addonResults: AddonSearchResult[] = [];
      const gameType = getWowGameType(installation.clientType);

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

      const missingAddonIds = filter(
        addonIds,
        (addonId) => find(addonResults, (sr) => sr.externalId === addonId) === undefined,
      );

      batchResult.errors[installation.id] = map(
        missingAddonIds,
        (addonId) => new SourceRemovedAddonError(addonId, undefined),
      );

      batchResult.installationResults[installation.id] = addonResults;
    }

    return batchResult;
  }

  public override async getAll(installation: WowInstallation, addonIds: string[]): Promise<GetAllResult> {
    const gameType = getWowGameType(installation.clientType);
    const url = new URL(`${this._baseUrl}/addons/batch/${gameType}`);
    const addonIdList = map(addonIds, (id) => parseInt(id, 10));

    const response = await this._networkInterface.postJson<GetAddonBatchResponse>(url, {
      body: {
        addonIds: addonIdList,
      },
      cache: true,
    });

    const searchResults = map(response?.addons, (addon) => this.getSearchResult(addon, gameType)).filter(
      (sr): sr is AddonSearchResult => sr !== undefined,
    );

    const missingAddonIds = filter(
      addonIds,
      (addonId) => find(searchResults, (sr) => sr?.externalId === addonId) === undefined,
    );

    const deletedErrors = map(missingAddonIds, (addonId) => new SourceRemovedAddonError(addonId, undefined));

    return {
      errors: [...deletedErrors],
      searchResults,
    };
  }

  public override async getFeaturedAddons(installation: WowInstallation): Promise<AddonSearchResult[]> {
    const gameType = getWowGameType(installation.clientType);
    const url = new window.URL(`${this._baseUrl}/addons/featured/${gameType}`);
    url.searchParams.set('count', '60');
    url.searchParams.set('recent', '30');

    const response = await this._networkInterface.getJson<GetFeaturedAddonsResponse>(url);

    // Remove duplicate addons that are already in the popular list from the recents list
    const uniqueRecent = (response.recent ?? []).filter((ru) => !response.addons.some((p) => p.id === ru.id));
    const addonResults = [...response.addons, ...uniqueRecent];

    const searchResults = map(addonResults, (addon) => this.getSearchResult(addon, gameType)).filter(
      (sr): sr is AddonSearchResult => sr !== undefined,
    );
    return searchResults;
  }

  public override async searchByQuery(query: string, installation: WowInstallation): Promise<AddonSearchResult[]> {
    const gameType = getWowGameType(installation.clientType);
    const url = new URL(`${this._baseUrl}/addons/search/${gameType}?query=${query}&limit=10`);

    const addons = await this._networkInterface.getJson<WowUpSearchAddonsResponse>(url);

    const searchResults = map(addons?.addons, (addon) => this.getSearchResult(addon, gameType)).filter(
      (sr): sr is AddonSearchResult => sr !== undefined,
    );

    return searchResults;
  }

  public override isValidAddonId(addonId: string): boolean {
    const idNumber = parseInt(addonId, 10);
    return !isNaN(idNumber) && isFinite(idNumber) && idNumber > 0;
  }

  public override async getCategory(
    category: AddonCategory,
    installation: WowInstallation,
  ): Promise<AddonSearchResult[]> {
    const gameType = getWowGameType(installation.clientType);
    const response = await this.getAddonsByCategory(gameType, category);

    const searchResults: AddonSearchResult[] = map(response?.addons, (addon) =>
      this.getSearchResult(addon, gameType),
    ).filter((sr): sr is AddonSearchResult => sr !== undefined);

    return searchResults ?? [];
  }

  public override async getById(
    addonId: string,
    installation: WowInstallation,
  ): Promise<AddonSearchResult | undefined> {
    const gameType = getWowGameType(installation.clientType);
    const url = new URL(`${this._baseUrl}/addons/${addonId}`);
    const result = await this._networkInterface.getJson<WowUpGetAddonResponse>(url);

    return this.getSearchResult(result.addon, gameType);
  }

  public override async getChangelog(
    installation: WowInstallation,
    externalId: string,
    externalReleaseId: string,
  ): Promise<string> {
    try {
      const addon = await this.getReleaseById(externalId, externalReleaseId);
      return addon?.release?.body ?? '';
    } catch (e) {
      console.error('Failed to get changelog', e);
    }

    return '';
  }

  private parseProtocol(protocol: string): ProtocolData {
    const url = new window.URL(protocol);
    return {
      addonId: url.searchParams.get('addonId') || '',
      releaseId: url.searchParams.get('releaseId') || '',
    };
  }

  private getAddonReleaseChannel(file: WowUpAddonReleaseRepresentation) {
    return file.prerelease ? AddonChannelType.Beta : AddonChannelType.Stable;
  }

  // Only 1 game version should match a given game type
  private getMatchingVersion(release: WowUpAddonReleaseRepresentation, gameType: WowGameType) {
    return release.game_versions.find((gv) => gv.game_type === gameType);
  }

  private filterReleases(representation: WowUpAddonRepresentation, gameType: WowGameType) {
    return filter(representation.releases, (release) => release.game_versions.some((gv) => gv.game_type === gameType));
  }

  private getLatestFiles(result: WowUpAddonRepresentation, gameType: WowGameType): WowUpAddonReleaseRepresentation[] {
    const filtered = filter(result?.releases, (latestFile) => !!this.getMatchingVersion(latestFile, gameType));
    return sortBy(filtered, (latestFile) => latestFile.id).reverse();
  }

  private hasMatchingFingerprint(
    scanResult: WowUpScanResult,
    release: WowUpAddonReleaseRepresentation | undefined,
  ): boolean {
    if (!release?.addonFolders) {
      return false;
    }

    return release.addonFolders.some((addonFolder) => addonFolder.fingerprint === scanResult.scanResult?.fingerprint);
  }

  private getSearchResultFile(
    release: WowUpAddonReleaseRepresentation,
    gameType: WowGameType,
  ): AddonSearchResultFile | undefined {
    const matchingVersion = this.getMatchingVersion(release, gameType);
    if (!matchingVersion) {
      return undefined;
    }

    return this.getSearchResultFileWithVersion(release, matchingVersion);
  }

  private hasGameType(release: WowUpAddonReleaseRepresentation | undefined, clientType: WowGameType): boolean {
    if (!release) {
      return false;
    }

    const matchingVersion = this.getMatchingVersion(release, clientType);
    return matchingVersion !== undefined;
  }

  private getSearchResultFileWithVersion(
    release: WowUpAddonReleaseRepresentation,
    matchingVersion: AddonReleaseGameVersion,
  ): AddonSearchResultFile | undefined {
    const version = matchingVersion?.version || release.tag_name || '';

    return {
      channelType: this.getAddonReleaseChannel(release),
      downloadUrl: release.download_url,
      folders: [],
      gameVersion: getGameVersion(matchingVersion?.interface),
      releaseDate: release.published_at,
      version,
      dependencies: [],
      changelog: release.body,
      externalId: release.id.toString(),
      title: release.toc_title ?? matchingVersion?.title,
      authors: matchingVersion?.authors,
    };
  }

  private getAddon(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    scanResult: WowUpScanResult,
  ): Addon {
    const gameType = getWowGameType(installation.clientType);
    const matchedRelease = scanResult.exactMatch?.matched_release;
    if (!matchedRelease || !matchedRelease.addonFolders) {
      throw new Error('No matched release');
    }

    const folders = matchedRelease.addonFolders.map((af) => af.folder_name);
    const folderList = folders.join(', ');
    const channelType = addonChannelType;

    let matchingVersion = this.getMatchingVersion(matchedRelease, gameType);
    if (!matchingVersion) {
      matchingVersion = matchedRelease.game_versions[0];
      console.warn(
        `No matching version found: ${scanResult.exactMatch?.repository_name ?? ''}, using fallback ${
          matchingVersion?.interface ?? ''
        }`,
      );
    }

    const name = matchingVersion?.title || scanResult.exactMatch?.repository_name;
    const version = matchingVersion?.version || scanResult.exactMatch?.matched_release?.tag_name || '';
    const authors = matchingVersion?.authors || scanResult.exactMatch?.owner_name || '';
    const interfaceVer = [matchingVersion?.interface];

    if (!name || !version || !interfaceVer) {
      throw new Error(`Invalid matching version data: name ${name}, version ${version}, interfaceVer ${interfaceVer}`);
    }

    const screenshotUrls = this.getScreenshotUrls([matchedRelease]);
    const externalUrl = scanResult.exactMatch ? `${this._websiteUrl}/addons/${scanResult.exactMatch.id}` : 'unknown';

    return {
      id: uuidv4(),
      author: authors,
      name,
      channelType,
      autoUpdateEnabled: false,
      autoUpdateNotificationsEnabled: false,
      clientType: installation.clientType,
      downloadUrl: scanResult.exactMatch?.matched_release?.download_url ?? '',
      externalUrl,
      externalId: scanResult.exactMatch?.id.toString() ?? 'unknown',
      gameVersion: getGameVersionList(interfaceVer),
      installedAt: new Date(),
      installedFolders: folderList,
      installedFolderList: folders,
      installedVersion: version,
      installedExternalReleaseId: scanResult.exactMatch?.matched_release?.id.toString() ?? 'unknown',
      isIgnored: false,
      latestVersion: version,
      providerName: this.name,
      providerSource: scanResult.exactMatch?.source ?? 'unknown',
      thumbnailUrl: scanResult.exactMatch?.image_url ?? '',
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

  private getSearchResult(
    representation: WowUpAddonRepresentation,
    gameType: WowGameType,
  ): AddonSearchResult | undefined {
    const clientReleases = this.filterReleases(representation, gameType);
    const searchResultFiles: AddonSearchResultFile[] = map(clientReleases, (release) =>
      this.getSearchResultFile(release, gameType),
    ).filter((sr): sr is AddonSearchResultFile => sr !== undefined);

    if (searchResultFiles.length === 0) {
      return undefined;
    }

    const name = first(searchResultFiles)?.title ?? representation.repository_name;
    const authors = first(searchResultFiles)?.authors ?? representation.owner_name ?? '';

    return {
      author: authors,
      externalId: representation.id.toString(),
      externalUrl: `${this._websiteUrl}/addons/${representation.id}`,
      name,
      providerName: this.name,
      thumbnailUrl: representation.image_url || representation.owner_image_url || '',
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
    releases: WowUpAddonReleaseRepresentation[],
  ): AddonSearchResult | undefined {
    const searchResultFiles: AddonSearchResultFile[] = flatMap(releases, (release) =>
      map(release.game_versions, (gv) => this.getSearchResultFileWithVersion(release, gv)).filter(
        (r): r is AddonSearchResultFile => r !== undefined,
      ),
    ).filter((sr) => sr !== undefined);

    if (searchResultFiles.length === 0) {
      return undefined;
    }

    const name = first(searchResultFiles)?.title ?? representation.repository_name;
    const authors = first(searchResultFiles)?.authors ?? representation.owner_name ?? '';

    return {
      author: authors,
      externalId: representation.id.toString(),
      externalUrl: `${this._websiteUrl}/addons/${representation.id}`,
      name,
      providerName: this.name,
      thumbnailUrl: representation.image_url || representation.owner_image_url || '',
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
    const urls: string[] = flatten(
      releases.map((release) =>
        release.previews?.filter((preview) => preview.preview_type === 'image').map((preview) => preview.url),
      ),
    ).filter((url): url is string => typeof url === 'string');

    return uniq(urls);
  }

  private async getReleaseById(addonId: string, releaseId: string): Promise<WowUpGetAddonReleaseResponse> {
    const url = new URL(`${this._baseUrl}/addons/${addonId}/releases/${releaseId}`);
    return await this._networkInterface.getJson<WowUpGetAddonReleaseResponse>(url);
  }

  private async getAddonById(addonId: number | string) {
    const url = new URL(`${this._baseUrl}/addons/${addonId}`);
    return await this._networkInterface.getJson<WowUpGetAddonResponse>(url);
  }

  private async getAddonsByCategory(gameType: WowGameType, category: AddonCategory) {
    const url = new URL(`${this._baseUrl}/addons/category/${category}/${gameType}`);
    return await this._networkInterface.getJson<WowUpGetAddonsResponse>(url);
  }

  private getAddonsByFingerprints(fingerprints: string[]): Promise<GetAddonsByFingerprintResponse> {
    const url = `${this._baseUrl}/addons/fingerprint`;
    return this._networkInterface.postJson<any>(url, {
      body: {
        fingerprints,
      },
    });
  }
}
