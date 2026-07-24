import { filter, find, first, map, orderBy, some, sortBy } from 'lodash';
import * as stringSimilarity from 'string-similarity';
import { v4 as uuidv4 } from 'uuid';

import { AddonProvider, GetAllResult } from '../addon-provider';
import { Addon, AddonFolder, AddonSearchResult, AddonSearchResultFile } from '../addons';
import { ADDON_PROVIDER_TUKUI } from '../constants';
import { SourceRemovedAddonError } from '../errors';
import { TukUiAddon, WowInstallation } from '../models';
import { Toc } from '../toc';
import { AddonCategory, AddonChannelType, WowClientType } from '../types';
import { convertMarkdown, getEnumName, getTocForGameType2, NetworkInterface } from '../utils';

const NEW_API_URL = 'https://api.tukui.org/v1/addons';
const DOWNLOAD_CT = 2147483647;

export class TukUiAddonProvider extends AddonProvider {
  public readonly name = ADDON_PROVIDER_TUKUI;
  public readonly forceIgnore = false;
  public readonly allowReinstall = true;
  public readonly allowChannelChange = false;
  public readonly allowEdit = true;

  public enabled = true;

  public constructor(private _networkInterface: NetworkInterface) {
    super();
  }

  public async getCategory(category: AddonCategory, installation: WowInstallation): Promise<AddonSearchResult[]> {
    // TBD categories are no longer available
    const allAddons = await this.getAllAddons(installation.clientType);

    const searchResults: AddonSearchResult[] = [];
    for (const addon of allAddons) {
      const searchResult = await this.toSearchResult(addon, installation);
      if (searchResult) {
        searchResults.push(searchResult);
      }
    }

    return searchResults;
  }

  public async getDescription(installation: WowInstallation, externalId: string): Promise<string> {
    const addons = await this.getAllAddons(installation.clientType);
    const addonMatch = find(addons, (addon) => addon.id.toString() === externalId.toString());
    return addonMatch?.small_desc ?? '';
  }

  public async getChangelog(installation: WowInstallation, externalId: string): Promise<string> {
    const addons = await this.getAllAddons(installation.clientType);
    const addon = find(addons, (a) => a.id.toString() === externalId.toString());
    if (!addon) {
      console.warn('Addon not found');
      return '';
    }

    return await this.formatChangelog(addon);
  }

  public async getAll(installation: WowInstallation, addonIds: string[]): Promise<GetAllResult> {
    const validIds = filter(addonIds, (aid) => this.isValidAddonId(aid));
    const errors: Error[] = filter(addonIds, (aid) => !this.isValidAddonId(aid)).map(
      (aid) => new Error('invalid addon id found: ' + aid),
    );
    let results: AddonSearchResult[] = [];

    try {
      const addons = await this.getAllAddons(installation.clientType);
      const filteredAddons = addons.filter((addon) => some(validIds, (aid) => aid.toString() === addon.id.toString()));
      results = await this.mapAddonsToSearchResults(filteredAddons, installation);
    } catch (e) {
      console.error('Failed during getAll', e);
    }

    if (results.length !== validIds.length) {
      const missingIds = filter(validIds, (aid) => !some(results, (r) => r.externalId === aid));
      errors.push(...map(missingIds, (mid) => new SourceRemovedAddonError(mid, new Error('addon not found ' + mid))));
    }

    return {
      errors,
      searchResults: results,
    };
  }

  public async getFeaturedAddons(installation: WowInstallation): Promise<AddonSearchResult[]> {
    const tukUiAddons = await this.getAllAddons(installation.clientType);
    return await this.mapAddonsToSearchResults(tukUiAddons, installation);
  }

  public async searchByQuery(query: string, installation: WowInstallation): Promise<AddonSearchResult[]> {
    const searchResults = await this.searchAddons(query, installation.clientType, true);

    const similarAddons = orderBy(searchResults, ['downloads']);

    return await this.mapAddonsToSearchResults(similarAddons, installation);
  }

  public override async getById(
    addonId: string,
    installation: WowInstallation,
  ): Promise<AddonSearchResult | undefined> {
    const addons = await this.getAllAddons(installation.clientType);

    const match = find(addons, (addon) => addon.id.toString() === addonId);
    if (match !== undefined) {
      return await this.toSearchResult(match, installation);
    }

    return undefined;
  }

  public isValidAddonId(addonId: string): boolean {
    return typeof addonId === 'string' && !isNaN(parseInt(addonId, 10));
  }

  public async scan(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[],
  ): Promise<void> {
    const allAddons = await this.getAllAddons(installation.clientType);

    // Sort folders to prioritize ones with a toc id
    let tukProjectAddonFolders = sortBy(addonFolders, (folder) =>
      folder.tocs.some((toc) => !!toc.tukUiProjectId && toc.loadOnDemand !== '1'),
    ).reverse();

    // Remove all folders that do not have a matching game type
    tukProjectAddonFolders = filter(
      tukProjectAddonFolders,
      (af) => getTocForGameType2(af, installation.clientType) !== undefined,
    );

    // Go thru all the folders, see if they have an ID we can match.
    await this.scanAddonsWithIds(tukProjectAddonFolders, allAddons, installation, addonChannelType);

    // Go thru all the folders and see if any of the non-matched belong to the folder list of any matched ones
    await this.matchAddonSubfolders(tukProjectAddonFolders, installation);

    // Go thru all the folders and see if the names match anything that did not have a match
    await this.scanAddonsWithNames(tukProjectAddonFolders, installation, addonChannelType);

    // repeat step 2 for remaining non-matched folders
    await this.matchAddonSubfolders(tukProjectAddonFolders, installation);
  }

  private async mapAddonsToSearchResults(addons: TukUiAddon[], installation: WowInstallation) {
    const results: AddonSearchResult[] = [];
    for (const addon of addons) {
      const searchResult = await this.toSearchResult(addon, installation);
      if (searchResult) {
        results.push(searchResult);
      }
    }
    return results;
  }

  private async formatChangelog(addon: TukUiAddon): Promise<string> {
    try {
      return await this.fetchChangelogHtml(addon);
    } catch (e) {
      console.error('Failed to get changelog', e);
      return '';
    }
  }

  private fetchChangelogHtml = async (addon: TukUiAddon): Promise<string> => {
    const markdown = await this._networkInterface.getText(addon.changelog_url);
    return convertMarkdown(markdown);
  };

  private async searchAddons(
    addonName: string | undefined,
    clientType: WowClientType,
    allowContain = false,
  ): Promise<TukUiAddon[]> {
    if (!addonName) {
      return [];
    }

    const canonAddonName = addonName.toLowerCase();
    const addons = await this.getAllAddons(clientType);

    const similarity = addons
      .map((addon) => {
        const compSim = stringSimilarity.compareTwoStrings(canonAddonName, addon.name.toLowerCase());
        return { addon, similarity: compSim };
      })
      .filter((result) => result.similarity > 0.7);

    let matches = orderBy(similarity, (match) => match.similarity, 'desc').map((result) => result.addon);

    // If we didnt get any similarity matches
    if (allowContain && matches.length === 0) {
      matches = addons.filter((addon) => addon.name.toLowerCase().indexOf(canonAddonName) !== -1);
    }

    return matches;
  }

  private async toSearchResult(
    addon: TukUiAddon,
    installation: WowInstallation,
  ): Promise<AddonSearchResult | undefined> {
    if (!addon) {
      return undefined;
    }

    const latestFile: AddonSearchResultFile = {
      channelType: AddonChannelType.Stable,
      folders: addon.directories,
      downloadUrl: addon.url,
      gameVersion: this.getPatchForInstall(addon, installation),
      version: addon.version,
      releaseDate: new Date(`${addon.last_update} UTC`),
      changelog: undefined, //await this.formatChangelog(addon),
    };

    return {
      author: addon.author,
      externalId: addon.id.toString(),
      name: addon.name,
      thumbnailUrl: addon.screenshot_url,
      externalUrl: addon.web_url,
      providerName: this.name,
      downloadCount: DOWNLOAD_CT,
      files: [latestFile],
      summary: addon.small_desc,
    };
  }

  private getPatchForInstall(addon: TukUiAddon, installation: WowInstallation): string {
    const classicToken = '1.';
    const burningCrusadeToken = '2.';
    const wrathToken = '3.';
    const cataToken = '4.';
    const mistsToken = '5.';

    switch (installation.clientType) {
      case WowClientType.Classic:
      case WowClientType.ClassicPtr:
      case WowClientType.ClassicBeta:
        return addon.patch.find((p) => p.startsWith(mistsToken)) ?? '';
      case WowClientType.ClassicEra:
      case WowClientType.ClassicEraPtr:
        return addon.patch.find((p) => p.startsWith(classicToken)) ?? '';
      case WowClientType.Anniversary:
        return addon.patch.find((p) => p.startsWith(burningCrusadeToken)) ?? '';
      default:
        return (
          addon.patch.find(
            (p) =>
              !p.startsWith(classicToken) &&
              !p.startsWith(wrathToken) &&
              !p.startsWith(cataToken) &&
              !p.startsWith(mistsToken),
          ) ?? ''
        );
    }
  }

  private getAllAddons = async (clientType: WowClientType): Promise<TukUiAddon[]> => {
    if (clientType === WowClientType.None) {
      return [];
    }

    try {
      return this.fetchApiResults();
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  private fetchApiResults = async () => {
    const url = new window.URL(NEW_API_URL);
    const addons = await this._networkInterface.getJson<TukUiAddon[]>(url);
    return addons;
  };

  /** Iterate the list of addon folders, attempting to find and match anything based on the ID inside the correct toc file */
  private async scanAddonsWithIds(
    addonFolders: AddonFolder[],
    allAddons: TukUiAddon[],
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
  ): Promise<void> {
    for (const addonFolder of addonFolders) {
      const targetToc = getTocForGameType2(addonFolder, installation.clientType);
      if (targetToc === undefined) {
        console.warn(`[TukUI]: target toc was undefined`, installation.clientType, addonFolder);
        continue;
      }

      console.log(`[TukUI]: target ${targetToc.fileName}, ${targetToc.title}, ${targetToc.tukUiProjectId}`);

      if (typeof targetToc.tukUiProjectId === 'string' && targetToc.tukUiProjectId.length > 0) {
        const match = find(allAddons, (addon) => addon.id.toString() === targetToc.tukUiProjectId);
        if (match === undefined) {
          continue;
        }

        addonFolder.matchingAddon = await this.createAddonFolderAddon(
          targetToc,
          addonFolder,
          match,
          installation,
          addonChannelType,
        );
      }
    }
  }

  private async scanAddonsWithNames(
    addonFolders: AddonFolder[],
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
  ): Promise<void> {
    const missingAddons = filter(addonFolders, (af) => af.matchingAddon === undefined);

    for (const addonFolder of missingAddons) {
      const targetToc = getTocForGameType2(addonFolder, installation.clientType);
      if (targetToc === undefined) {
        console.warn(`[TukUI]: target toc was undefined`, installation.clientType, addonFolder);
        continue;
      }

      console.info(`[TukUI]: falling back to title search`, targetToc.title);
      const results = await this.searchAddons(targetToc.title, installation.clientType);
      const firstResult = first(results);
      if (firstResult === undefined) {
        continue;
      }

      addonFolder.matchingAddon = await this.createAddonFolderAddon(
        targetToc,
        addonFolder,
        firstResult,
        installation,
        addonChannelType,
      );
    }
  }

  /** Given a list of pre-processed addon folders, attempt to place any matching folders with their 'parent' addon that has a list containing it */
  private async matchAddonSubfolders(addonFolders: AddonFolder[], installation: WowInstallation): Promise<void> {
    const matchedAddons = filter(addonFolders, (af) => af.matchingAddon !== undefined);
    const missingAddons = filter(addonFolders, (af) => af.matchingAddon === undefined);

    for (const addonFolder of missingAddons) {
      const targetToc = getTocForGameType2(addonFolder, installation.clientType);
      if (targetToc === undefined) {
        console.warn(`[TukUI]: target toc was undefined`, installation.clientType, addonFolder);
        continue;
      }

      const parent = matchedAddons.find((ma) => ma.matchingAddon?.installedFolderList?.includes(addonFolder.name));
      if (parent?.matchingAddon === undefined) {
        continue;
      }

      console.info(
        `[TukUI]: parent found ${parent.name} : ${targetToc.fileName}, ${targetToc.title}, ${targetToc.tukUiProjectId}`,
      );

      // this match is just a copy of the parent since its a sub-addon
      addonFolder.matchingAddon = { ...parent.matchingAddon };
    }
  }

  /** Create an addon from the matched TukUi addon and correct toc file */
  private async createAddonFolderAddon(
    targetToc: Toc,
    addonFolder: AddonFolder,
    tukUiAddon: TukUiAddon,
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
  ): Promise<Addon> {
    const installedFolders = targetToc.tukUiProjectFolders ? targetToc.tukUiProjectFolders : addonFolder.name;

    const installedFolderList = targetToc.tukUiProjectFolders
      ? targetToc.tukUiProjectFolders.split(',').map((f) => f.trim())
      : [addonFolder.name];

    return {
      autoUpdateEnabled: false,
      autoUpdateNotificationsEnabled: false,
      channelType: addonChannelType,
      clientType: installation.clientType,
      id: uuidv4(),
      isIgnored: false,
      name: tukUiAddon.name,
      author: tukUiAddon.author,
      downloadUrl: tukUiAddon.url,
      externalId: tukUiAddon.id.toString(),
      externalUrl: tukUiAddon.web_url,
      gameVersion: targetToc.interface,
      installedAt: addonFolder.fileStats?.birthtime ?? new Date(0),
      installedFolders,
      installedFolderList,
      installedVersion: targetToc.version,
      latestVersion: tukUiAddon.version,
      providerName: this.name,
      thumbnailUrl: tukUiAddon.screenshot_url,
      updatedAt: new Date(),
      summary: tukUiAddon.small_desc,
      downloadCount: DOWNLOAD_CT,
      screenshotUrls: [tukUiAddon.screenshot_url],
      releasedAt: new Date(`${tukUiAddon.last_update} UTC`),
      isLoadOnDemand: false,
      latestChangelog: undefined, //await this.formatChangelog(tukUiAddon),
      externalChannel: getEnumName(AddonChannelType, AddonChannelType.Stable),
      installationId: installation.id,
    };
  }
}
