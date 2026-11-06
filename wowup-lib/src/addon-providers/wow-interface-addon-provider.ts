import { filter, first, flatten, map, uniq } from 'lodash';
import { v4 as uuidv4 } from 'uuid';

import { AddonProvider, GetAllResult, SearchByUrlResult } from '../addon-provider';
import { Addon, AddonFolder, AddonSearchResult, AddonSearchResultFile } from '../addons';
import { ADDON_PROVIDER_WOWINTERFACE } from '../constants';
import { SourceRemovedAddonError } from '../errors';
import { AddonDetailsResponseV3, AddonDetailsResponseV4, WowInstallation } from '../models';
import { AddonChannelType } from '../types';
import { convertBbcode, getEnumName, getGameVersionList, getTocForGameType2, NetworkInterface } from '../utils';

const API_URL = 'https://api.mmoui.com/v4/game/WOW';
const API_URL_FALLBACK = 'https://api.mmoui.com/v3/game/WOW';
const ADDON_URL = 'https://www.wowinterface.com/downloads/info';

export class WowInterfaceAddonProvider extends AddonProvider {
  public readonly name = ADDON_PROVIDER_WOWINTERFACE;
  public readonly forceIgnore = false;
  public readonly allowReinstall = true;
  public readonly allowChannelChange = false;
  public readonly allowEdit = true;
  public enabled = true;

  public constructor(private _networkInterface: NetworkInterface) {
    super();
  }

  public override async getDescription(installation: WowInstallation, externalId: string): Promise<string> {
    try {
      const addonDetails = await this.getAddonDetails(externalId);
      return convertBbcode(addonDetails?.description ?? '');
    } catch (error) {
      console.error(error);
      return '';
    }
  }

  public override async getAll(installation: WowInstallation, addonIds: string[]): Promise<GetAllResult> {
    const filteredIds = filter(addonIds, (aid) => this.isValidAddonId(aid));
    const errors: Error[] = filter(addonIds, (aid) => !this.isValidAddonId(aid)).map(
      (aid) => new Error(`invalid addon id found: ${aid}`),
    );

    let searchResults = await this.getAllById(filteredIds);
    searchResults = filter(searchResults, (sr) => filteredIds.includes(sr.externalId));

    if (searchResults.length !== filteredIds.length) {
      const missingIds = filter(filteredIds, (aid) => !searchResults.some((sr) => sr.externalId === aid));
      errors.push(
        ...map(missingIds, (mid) => new SourceRemovedAddonError(mid, new Error('addon not returned ' + mid))),
      );
    }

    return {
      errors,
      searchResults,
    };
  }

  public override async getChangelog(installation: WowInstallation, externalId: string): Promise<string> {
    try {
      const addon = await this.getAddonDetails(externalId);
      return convertBbcode(addon?.changeLog ?? '');
    } catch (error) {
      console.error(`Failed to get addon changelog`, error);
      return '';
    }
  }

  public override async searchByUrl(addonUri: URL): Promise<SearchByUrlResult> {
    const addonId = this.getAddonId(addonUri);
    if (addonId.length === 0) {
      throw new Error(`Addon ID not found ${addonUri.toString()}`);
    }

    const addon = await this.getAddonDetails(addonId);
    if (addon === undefined) {
      throw new Error(`Bad addon api response ${addonUri.toString()}`);
    }

    const searchResult = this.toAddonSearchResult(addon);
    if (searchResult === undefined) {
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
      return this.toAddonSearchResult(result, '');
    }
  }

  public override isValidAddonUri(addonUri: URL): boolean {
    return typeof addonUri.host === 'string' && addonUri.host.length > 0 && addonUri.host.endsWith('wowinterface.com');
  }

  public override isValidAddonId(addonId: string): boolean {
    return typeof addonId === 'string' && addonId.length > 0 && !isNaN(parseInt(addonId, 10));
  }

  public override async scan(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[],
  ): Promise<void> {
    const wowiFolders = addonFolders.filter((folder) =>
      folder.tocs.some((toc) => !!toc.wowInterfaceId && toc.loadOnDemand !== '1'),
    );
    const addonIds = uniq(flatten(wowiFolders.map((folder) => folder.tocs.map((toc) => toc.wowInterfaceId)))).filter(
      (aid): aid is string => aid !== undefined,
    );

    const addonDetails = await this.getAllAddonDetails(addonIds);

    for (const addonFolder of wowiFolders) {
      const targetToc = getTocForGameType2(addonFolder, installation.clientType);
      if (!targetToc?.wowInterfaceId) {
        continue;
      }

      const details = addonDetails.find((ad) => ad.id.toString() === targetToc.wowInterfaceId);
      if (!details) {
        console.warn('Details not found');
        continue;
      }

      addonFolder.matchingAddon = this.toAddon(details, installation, addonChannelType, addonFolder);
    }
  }

  // https://www.wowinterface.com/downloads/download25538-Aardvark
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

  private getAddonDetails = async (addonId: string): Promise<AddonDetailsResponseV4 | undefined> => {
    if (typeof addonId !== 'string' || addonId.length === 0) {
      return undefined;
    }

    const url = new URL(`${API_URL}/filedetails/${addonId}.json`);

    let responses: AddonDetailsResponseV4[] = [];
    try {
      responses = await this._networkInterface.getJson<AddonDetailsResponseV4[]>(url);
    } catch (e) {
      console.warn('[wowi] addon details failed, using fallback', e);

      try {
        const fallbackUrl = new URL(`${API_URL_FALLBACK}/filedetails/${addonId}.json`);
        const fallbackResponses = await this._networkInterface.getJson<AddonDetailsResponseV3[]>(fallbackUrl);
        if (Array.isArray(fallbackResponses)) {
          responses = map(fallbackResponses, (fr) => this.toV4(fr));
        }
      } catch (e) {
        console.error('[wowi] fallback request failed', e);
      }
    }

    return first(responses);
  };

  private toV4(details: AddonDetailsResponseV3): AddonDetailsResponseV4 {
    return {
      author: details.UIAuthorName,
      categoryId: parseInt(details.UICATID, 10),
      changeLog: details.UIChangeLog,
      checksum: details.UIMD5,
      description: details.UIDescription,
      downloads: parseInt(details.UIHitCount, 10),
      downloadsMonthly: parseInt(details.UIHitCountMonthly, 10),
      downloadUri: details.UIDownload,
      favorites: parseInt(details.UIFavoriteTotal, 10),
      fileName: details.UIFileName,
      id: parseInt(details.UID, 10),
      images: [],
      lastUpdate: details.UIDate,
      pendingUpdate: details.UIPending,
      title: details.UIName,
      version: details.UIVersion,
    };
  }

  private getAllAddonDetails = async (addonIds: string[]): Promise<AddonDetailsResponseV4[]> => {
    if (!Array.isArray(addonIds) || addonIds.length === 0) {
      return [];
    }

    let fallbackIds: string[] = [];
    let responses: AddonDetailsResponseV4[] = [];
    try {
      const url = new URL(`${API_URL}/filedetails/${addonIds.join(',')}.json`);
      responses = await this._networkInterface.getJson<AddonDetailsResponseV4[]>(url);
      fallbackIds = addonIds.filter((aid) => !responses.some((r) => r.id.toString() === aid));
    } catch (e) {
      console.warn('[wowi] addon details failed, using fallback', e);
      fallbackIds = [...addonIds];
    }

    if (fallbackIds.length > 0) {
      try {
        const fallbackUrl = new URL(`${API_URL_FALLBACK}/filedetails/${fallbackIds.join(',')}.json`);
        const v3Responses = await this._networkInterface.getJson<AddonDetailsResponseV3[]>(fallbackUrl);
        responses.push(...v3Responses.map((r) => this.toV4(r)));
      } catch (e) {
        console.warn('[wowi] addon details fallback failed', e);
      }
    }

    return responses;
  };

  private async getAllById(addonIds: string[]): Promise<AddonSearchResult[]> {
    const addonDetails = await this.getAllAddonDetails(addonIds);
    const mapped = addonDetails.map((ad) => this.toAddonSearchResult(ad, ''));
    const filtered = filter(mapped, (m): m is AddonSearchResult => m !== undefined);
    return filtered;
  }

  private getThumbnailUrl(response: AddonDetailsResponseV4): string {
    return first(response.images)?.thumbUrl ?? '';
  }

  private getAddonUrl(response: AddonDetailsResponseV4) {
    return `${ADDON_URL}${response.id}`;
  }

  private toAddon(
    response: AddonDetailsResponseV4,
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolder: AddonFolder,
  ): Addon {
    const targetToc = getTocForGameType2(addonFolder, installation.clientType);

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
      gameVersion: getGameVersionList(targetToc?.interface ?? []),
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

  private toAddonSearchResult(response: AddonDetailsResponseV4, folderName?: string): AddonSearchResult | undefined {
    try {
      const searchResultFile: AddonSearchResultFile = {
        channelType: AddonChannelType.Stable,
        version: response.version,
        downloadUrl: response.downloadUri,
        folders: folderName ? [folderName] : [],
        gameVersion: '',
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
      console.error('Failed to create addon search result', err);
      return undefined;
    }
  }
}
