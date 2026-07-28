import { v4 as uuidv4 } from 'uuid';

import { AddonProvider, GetAllResult } from '../addon-provider';
import { Addon, AddonFolder, AddonSearchResult, AddonSearchResultFile } from '../addons';
import { ADDON_PROVIDER_ASCENSION } from '../constants';
import { SourceRemovedAddonError } from '../errors';
import { WowInstallation } from '../models';
import { AddonChannelType, WowClientType } from '../types';
import { getEnumName, getGameVersionList, getTocForGameType2, NetworkInterface } from '../utils';

export interface AscensionCatalogRelease {
  id: string;
  version: string;
  channel: 'stable' | 'beta';
  folders: string[];
  downloadUrl: string;
  releasedAt: string;
  changelog?: string;
}

export interface AscensionCatalogAddon {
  id: string;
  name: string;
  author: string;
  summary?: string;
  description?: string;
  thumbnailUrl?: string;
  downloads?: number;
  releasedAt?: string;
  releases: AscensionCatalogRelease[];
}

export class AscensionAddonProvider extends AddonProvider {
  public readonly name = ADDON_PROVIDER_ASCENSION;
  public readonly forceIgnore = false;
  public readonly allowReinstall = true;
  public readonly allowChannelChange = true;
  public readonly allowEdit = true;
  public readonly allowReScan = true;
  public enabled = false;
  public providerNote = 'Community addons for Project Ascension (WoTLK 3.3.5).';

  public constructor(
    private _catalogUrl: string,
    private _websiteUrl: string,
    private _networkInterface: NetworkInterface,
  ) {
    super();
    this._catalogUrl = this._catalogUrl.replace(/\/$/, '');
    this._websiteUrl = this._websiteUrl.replace(/\/$/, '');
  }

  public override async getAll(installation: WowInstallation, addonIds: string[]): Promise<GetAllResult> {
    if (!this.isAscensionInstallation(installation)) {
      return { errors: [], searchResults: [] };
    }

    const errors: Error[] = [];
    const searchResults: AddonSearchResult[] = [];
    for (const addonId of addonIds) {
      if (!this.isValidAddonId(addonId)) {
        errors.push(new Error(`invalid addon id found: ${addonId}`));
        continue;
      }

      try {
        const result = await this.getById(addonId, installation);
        if (result) {
          searchResults.push(result);
        } else {
          errors.push(new SourceRemovedAddonError(addonId, new Error(`addon not found ${addonId}`)));
        }
      } catch (error) {
        errors.push(error as Error);
      }
    }

    return { errors, searchResults };
  }

  public override async getFeaturedAddons(installation: WowInstallation): Promise<AddonSearchResult[]> {
    if (!this.isAscensionInstallation(installation)) {
      return [];
    }

    // Community catalog entries are not curated yet, so the initial view lists every available addon.
    return await this.getCatalogAddons(installation);
  }

  public override async searchByQuery(query: string, installation: WowInstallation): Promise<AddonSearchResult[]> {
    if (!this.isAscensionInstallation(installation) || query.trim().length === 0) {
      return [];
    }

    return await this.getCatalogAddons(installation, `query=${encodeURIComponent(query)}`);
  }

  public override async getById(addonId: string, installation: WowInstallation): Promise<AddonSearchResult | undefined> {
    if (!this.isAscensionInstallation(installation) || !this.isValidAddonId(addonId)) {
      return undefined;
    }

    const addon = await this._networkInterface.getJson<AscensionCatalogAddon>(`${this._catalogUrl}/addons/${addonId}`);
    return this.toSearchResult(addon, installation);
  }

  public override async getDescription(installation: WowInstallation, externalId: string): Promise<string> {
    const addon = await this.getCatalogAddon(externalId, installation);
    return addon?.description ?? addon?.summary ?? '';
  }

  public override async getChangelog(
    installation: WowInstallation,
    externalId: string,
    externalReleaseId: string,
  ): Promise<string> {
    const addon = await this.getCatalogAddon(externalId, installation);
    return addon?.releases.find((release) => release.id === externalReleaseId)?.changelog ?? '';
  }

  public override isValidAddonId(addonId: string): boolean {
    return typeof addonId === 'string' && addonId.trim().length > 0;
  }

  public override async scan(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[],
  ): Promise<void> {
    if (!this.isAscensionInstallation(installation)) {
      return;
    }

    const addons = await this.getCatalogAddons(installation);
    for (const addonFolder of addonFolders) {
      const toc = getTocForGameType2(addonFolder, installation.clientType);
      if (!toc?.ascensionAddonId) {
        continue;
      }

      const addon = addons.find((candidate) => candidate.externalId === toc.ascensionAddonId);
      if (!addon) {
        continue;
      }

      const file = addon.files?.find(
        (candidate) => candidate.channelType === addonChannelType && candidate.folders.includes(addonFolder.name),
      );
      if (!file) {
        continue;
      }

      addonFolder.matchingAddon = this.toAddon(
        addon,
        file,
        installation,
        toc.version,
        toc.interface,
        addonFolder.name,
      );
    }
  }

  private async getCatalogAddons(installation: WowInstallation, query = ''): Promise<AddonSearchResult[]> {
    const url = `${this._catalogUrl}/addons${query ? `?${query}` : ''}`;
    const addons = await this._networkInterface.getJson<AscensionCatalogAddon[]>(url);
    return addons
      .map((addon) => this.toSearchResult(addon, installation))
      .filter((addon): addon is AddonSearchResult => addon !== undefined);
  }

  private async getCatalogAddon(addonId: string, installation: WowInstallation): Promise<AscensionCatalogAddon | undefined> {
    try {
      if (!this.isAscensionInstallation(installation) || !this.isValidAddonId(addonId)) {
        return undefined;
      }
      return await this._networkInterface.getJson<AscensionCatalogAddon>(`${this._catalogUrl}/addons/${addonId}`);
    } catch (error) {
      console.error('Failed to get Ascension addon details', error);
      return undefined;
    }
  }

  private toSearchResult(addon: AscensionCatalogAddon, installation: WowInstallation): AddonSearchResult | undefined {
    if (!addon?.id || !this.isAscensionInstallation(installation)) {
      return undefined;
    }

    const files = addon.releases
      .map((release) => this.toSearchResultFile(release))
      .filter((file): file is AddonSearchResultFile => file !== undefined);
    if (files.length === 0) {
      return undefined;
    }

    return {
      author: addon.author,
      downloadCount: addon.downloads,
      externalId: addon.id,
      externalUrl: `${this._websiteUrl}/addons/${addon.id}`,
      files,
      name: addon.name,
      providerName: this.name,
      releasedAt: addon.releasedAt ? new Date(addon.releasedAt) : undefined,
      summary: addon.summary,
      thumbnailUrl: addon.thumbnailUrl ?? '',
    };
  }

  private toSearchResultFile(release: AscensionCatalogRelease): AddonSearchResultFile | undefined {
    if (!release?.id || !release.downloadUrl || !release.version || release.folders.length === 0) {
      return undefined;
    }

    return {
      channelType: release.channel === 'beta' ? AddonChannelType.Beta : AddonChannelType.Stable,
      changelog: release.changelog,
      downloadUrl: release.downloadUrl,
      externalId: release.id,
      folders: release.folders,
      gameVersion: '3.3.5',
      releaseDate: new Date(release.releasedAt),
      version: release.version,
    };
  }

  private toAddon(
    result: AddonSearchResult,
    file: AddonSearchResultFile,
    installation: WowInstallation,
    installedVersion: string | undefined,
    interfaceVersions: string[],
    folderName: string,
  ): Addon {
    return {
      author: result.author,
      autoUpdateEnabled: installation.defaultAutoUpdate,
      autoUpdateNotificationsEnabled: true,
      channelType: file.channelType,
      clientType: installation.clientType,
      downloadUrl: file.downloadUrl,
      externalChannel: getEnumName(AddonChannelType, file.channelType),
      externalId: result.externalId,
      externalLatestReleaseId: file.externalId,
      externalUrl: result.externalUrl,
      gameVersion: getGameVersionList(interfaceVersions),
      id: uuidv4(),
      installationId: installation.id,
      installedExternalReleaseId: file.externalId,
      installedFolderList: [folderName],
      installedFolders: folderName,
      installedVersion: installedVersion ?? file.version,
      installedAt: new Date(),
      isIgnored: false,
      isLoadOnDemand: false,
      latestVersion: file.version,
      name: result.name,
      providerName: this.name,
      releasedAt: file.releaseDate,
      summary: result.summary,
      thumbnailUrl: result.thumbnailUrl,
      updatedAt: file.releaseDate,
    };
  }

  private isAscensionInstallation(installation: WowInstallation): boolean {
    return installation.clientType === WowClientType.Ascension;
  }
}
