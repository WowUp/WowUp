import * as _ from "lodash";
import { from, Observable, of } from "rxjs";
import { map, switchMap } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";
import * as stringSimilarity from "string-similarity";

import { ADDON_PROVIDER_TUKUI } from "../../common/constants";
import { WowClientType } from "../../common/warcraft/wow-client-type";
import { AddonCategory, AddonChannelType } from "../../common/wowup/models";
import { TukUiAddon } from "../models/tukui/tukui-addon";
import { AddonFolder } from "../models/wowup/addon-folder";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";
import { WowInstallation } from "../../common/warcraft/wow-installation";
import { CachingService } from "../services/caching/caching-service";
import { CircuitBreakerWrapper, NetworkService } from "../services/network/network.service";
import { getGameVersion } from "../utils/addon.utils";
import { getEnumName } from "../utils/enum.utils";
import { AddonProvider, GetAllResult } from "./addon-provider";
import { TocService } from "../services/toc/toc.service";

const API_URL = "https://www.tukui.org/api.php";
const CLIENT_API_URL = "https://www.tukui.org/client-api.php";
// const WOWUP_API_URL = AppConfig.wowUpHubUrl;
const CHANGELOG_CACHE_TTL_SEC = 30 * 60;

export class TukUiAddonProvider extends AddonProvider {
  private readonly _circuitBreaker: CircuitBreakerWrapper;

  public readonly name = ADDON_PROVIDER_TUKUI;
  public readonly forceIgnore = false;
  public readonly allowReinstall = true;
  public readonly allowChannelChange = false;
  public readonly allowEdit = true;

  public enabled = true;

  public constructor(
    private _cachingService: CachingService,
    private _networkService: NetworkService,
    private _tocService: TocService
  ) {
    super();
    this._circuitBreaker = this._networkService.getCircuitBreaker(`${this.name}_main`);
  }

  public async getCategory(category: AddonCategory, installation: WowInstallation): Promise<AddonSearchResult[]> {
    const addonCategories = this.mapAddonCategory(category);

    const allAddons = await this.getAllAddons(installation.clientType);
    const matchingAddons = allAddons.filter((addon) => addonCategories.some((cat) => addon.category === cat));

    const searchResults: AddonSearchResult[] = [];
    for (const addon of matchingAddons) {
      const searchResult = await this.toSearchResult(addon);
      if (searchResult) {
        searchResults.push(searchResult);
      }
    }

    return searchResults;
  }

  public async getDescription(installation: WowInstallation, externalId: string): Promise<string> {
    const addons = await this.getAllAddons(installation.clientType);
    const addonMatch = _.find(addons, (addon) => addon.id.toString() === externalId.toString());
    return addonMatch?.small_desc ?? "";
  }

  public async getChangelog(installation: WowInstallation, externalId: string): Promise<string> {
    const addons = await this.getAllAddons(installation.clientType);
    const addon = _.find(addons, (addon) => addon.id.toString() === externalId.toString());
    if (!addon) {
      console.warn("Addon not found");
      return "";
    }

    return (await this.formatChangelog(addon)) ?? "";
  }

  public async getAll(installation: WowInstallation, addonIds: string[]): Promise<GetAllResult> {
    let results: AddonSearchResult[] = [];

    try {
      const addons = await this.getAllAddons(installation.clientType);
      const filteredAddons = addons.filter((addon) =>
        _.some(addonIds, (aid) => aid.toString() === addon.id.toString())
      );
      results = await this.mapAddonsToSearchResults(filteredAddons);
    } catch (err) {
      // _analyticsService.Track(ex, "Failed to search TukUi");
    }

    return {
      errors: [],
      searchResults: results,
    };
  }

  public async getFeaturedAddons(installation: WowInstallation): Promise<AddonSearchResult[]> {
    const tukUiAddons = await this.getAllAddons(installation.clientType);
    return await this.mapAddonsToSearchResults(tukUiAddons);
  }

  public async searchByQuery(query: string, installation: WowInstallation): Promise<AddonSearchResult[]> {
    const searchResults = await this.searchAddons(query, installation.clientType, true);

    const similarAddons = _.orderBy(searchResults, ["downloads"]);

    return await this.mapAddonsToSearchResults(similarAddons);
  }

  public getById(addonId: string, installation: WowInstallation): Observable<AddonSearchResult | undefined> {
    return from(this.getAllAddons(installation.clientType)).pipe(
      map((addons) => _.find(addons, (addon) => addon.id === addonId)),
      switchMap((match) => (match !== undefined ? from(this.toSearchResult(match, "")) : of(undefined)))
    );
  }

  public isValidAddonUri(): boolean {
    return false;
  }

  public isValidAddonId(addonId: string): boolean {
    return !!addonId && !isNaN(parseInt(addonId, 10));
  }

  public async scan(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {
    const allAddons = await this.getAllAddons(installation.clientType);

    // Keep track of addons already matched to prevent duplicate folders being collapsed
    const matches: TukUiAddon[] = [];

    // Sort folders to prioritize ones with a toc id
    const tukProjectAddonFolders = _.sortBy(addonFolders, (folder) =>
      folder.tocs.some((toc) => !!toc.tukUiProjectId && toc.loadOnDemand !== "1")
    ).reverse();

    for (const addonFolder of tukProjectAddonFolders) {
      const targetToc = this._tocService.getTocForGameType2(addonFolder, installation.clientType);
      console.debug(`[TukUI]: target ${targetToc.fileName}, ${targetToc.title}, ${targetToc.tukUiProjectId}`);

      let tukUiAddon: TukUiAddon;
      if (targetToc?.tukUiProjectId) {
        const match = _.find(allAddons, (addon) => addon.id.toString() === targetToc.tukUiProjectId);
        if (!match) {
          continue;
        }

        tukUiAddon = match;
      } else {
        const results = await this.searchAddons(targetToc.title, installation.clientType);
        const firstResult = _.first(results);
        if (!firstResult) {
          continue;
        }

        tukUiAddon = firstResult;

        // If we got a fuzzy name match, ensure it's not already added to prevent hiding addons
        if (tukUiAddon && _.findIndex(matches, (match) => match.id.toString() === tukUiAddon.id.toString()) !== -1) {
          console.warn(`Overlapping addon: ${targetToc.title ?? ""} => ${tukUiAddon.name}`);
          continue;
        }
      }

      if (!tukUiAddon) {
        continue;
      }

      matches.push({ ...tukUiAddon });

      const installedFolders = targetToc.tukUiProjectFolders ? targetToc.tukUiProjectFolders : addonFolder.name;

      const installedFolderList = targetToc.tukUiProjectFolders
        ? targetToc.tukUiProjectFolders.split(",").map((f) => f.trim())
        : [addonFolder.name];

      addonFolder.matchingAddon = {
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
        gameVersion: getGameVersion(tukUiAddon.patch),
        installedAt: addonFolder.fileStats?.birthtime ?? new Date(0),
        installedFolders: installedFolders,
        installedFolderList: installedFolderList,
        installedVersion: targetToc.version,
        latestVersion: tukUiAddon.version,
        providerName: this.name,
        thumbnailUrl: tukUiAddon.screenshot_url,
        updatedAt: new Date(),
        summary: tukUiAddon.small_desc,
        downloadCount: Number.parseFloat(tukUiAddon.downloads),
        screenshotUrls: [tukUiAddon.screenshot_url],
        releasedAt: new Date(`${tukUiAddon.lastupdate} UTC`),
        isLoadOnDemand: false,
        latestChangelog: await this.formatChangelog(tukUiAddon),
        externalChannel: getEnumName(AddonChannelType, AddonChannelType.Stable),
        installationId: installation.id,
      };
    }
  }

  private async mapAddonsToSearchResults(addons: TukUiAddon[]) {
    const results: AddonSearchResult[] = [];
    for (const addon of addons) {
      const searchResult = await this.toSearchResult(addon, "");
      if (searchResult) {
        results.push(searchResult);
      }
    }
    return results;
  }

  private async formatChangelog(addon: TukUiAddon): Promise<string | undefined> {
    if (["-1", "-2"].includes(addon.id.toString())) {
      try {
        return await this.fetchChangelogHtml(addon);
      } catch (e) {
        console.error("Failed to get changelog", e);
      }
    }

    if (!addon.changelog) {
      return undefined;
    }

    return `<a href="${addon.changelog}">${addon.changelog}</a>`;
  }

  private fetchChangelogHtml = async (addon: TukUiAddon): Promise<string> => {
    const cacheKey = `${this.name}_changelog_${addon.id}`;
    const html = await this._cachingService.transaction(
      cacheKey,
      () => this._circuitBreaker.getText(addon.changelog),
      CHANGELOG_CACHE_TTL_SEC
    );
    return html;
  };

  private async searchAddons(
    addonName: string | undefined,
    clientType: WowClientType,
    allowContain = false
  ): Promise<TukUiAddon[]> {
    if (!addonName) {
      return [];
    }

    const canonAddonName = addonName.toLowerCase();
    const addons = await this.getAllAddons(clientType);

    const similarity = addons
      .map((addon) => {
        const similarity = stringSimilarity.compareTwoStrings(canonAddonName, addon.name.toLowerCase());
        return { addon, similarity };
      })
      .filter((result) => result.similarity > 0.7);

    let matches = _.orderBy(similarity, (match) => match.similarity, "desc").map((result) => result.addon);

    // If we didnt get any similarity matches
    if (allowContain && matches.length === 0) {
      matches = addons.filter((addon) => addon.name.toLowerCase().indexOf(canonAddonName) !== -1);
    }

    return matches;
  }

  private async toSearchResult(addon: TukUiAddon, folderName = ""): Promise<AddonSearchResult | undefined> {
    if (!addon) {
      return undefined;
    }

    const latestFile: AddonSearchResultFile = {
      channelType: AddonChannelType.Stable,
      folders: folderName ? [folderName] : [],
      downloadUrl: addon.url,
      gameVersion: getGameVersion(addon.patch),
      version: addon.version,
      releaseDate: new Date(`${addon.lastupdate} UTC`),
      changelog: await this.formatChangelog(addon),
    };

    return {
      author: addon.author,
      externalId: addon.id.toString(),
      name: addon.name,
      thumbnailUrl: addon.screenshot_url,
      externalUrl: addon.web_url,
      providerName: this.name,
      downloadCount: parseInt(addon.downloads, 10),
      files: [latestFile],
      summary: addon.small_desc,
    };
  }

  private getAllAddons = async (clientType: WowClientType): Promise<TukUiAddon[]> => {
    if (clientType === WowClientType.None) {
      return [];
    }

    try {
      const cacheKey = `${this.name}_all_addons_${this.getAddonsCacheType(clientType)}`;
      const addons = await this._cachingService.transaction(cacheKey, () => this.fetchApiResults(clientType));
      return addons;
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  // private fetchApiResultsWowUp = async (clientType: WowClientType) => {
  //   const clientTypeName = this.getAddonsSuffixWowUp(clientType);
  //   const url = new URL(`${WOWUP_API_URL}/tukui/${clientTypeName}`);

  //   const addons = await this._httpClient.get<TukUiAddon[]>(url.toString()).toPromise();
  //   console.debug("WowUpTukui", addons);

  //   return addons;
  // };

  private fetchApiResults = async (clientType: WowClientType) => {
    const query = this.getAddonsSuffix(clientType);
    const url = new URL(API_URL);
    url.searchParams.append(query, "all");

    const addons = await this._circuitBreaker.getJson<TukUiAddon[]>(url);

    if (this.isRetail(clientType)) {
      addons.push(await this.getTukUiRetailAddon());
      addons.push(await this.getElvUiRetailAddon());
    }
    return addons;
  };

  private getTukUiRetailAddon() {
    return this.getClientApiAddon("tukui");
  }

  private getElvUiRetailAddon() {
    return this.getClientApiAddon("elvui");
  }

  private async getClientApiAddon(addonName: string): Promise<TukUiAddon> {
    const url = new URL(CLIENT_API_URL);
    url.searchParams.append("ui", addonName);

    const result = await this._circuitBreaker.getJson<TukUiAddon>(url);
    result.id = result.id.toString(); // For some reason addons from this route have numeric ids not strings

    return result;
  }

  private isRetail(clientType: WowClientType) {
    switch (clientType) {
      case WowClientType.Retail:
      case WowClientType.RetailPtr:
      case WowClientType.Beta:
        return true;
      default:
        return false;
    }
  }

  private getAddonsSuffix(clientType: WowClientType) {
    switch (clientType) {
      case WowClientType.ClassicEra:
      case WowClientType.ClassicEraPtr:
        return "classic-addons";
      case WowClientType.Classic:
      case WowClientType.ClassicPtr:
      case WowClientType.ClassicBeta:
        return "classic-wotlk-addons";
      case WowClientType.Retail:
      case WowClientType.RetailPtr:
      case WowClientType.Beta:
        return "addons";
      default:
        return "";
    }
  }

  private getAddonsCacheType(clientType: WowClientType) {
    switch (clientType) {
      case WowClientType.ClassicEra:
      case WowClientType.ClassicEraPtr:
        return "classic";
      case WowClientType.Classic:
      case WowClientType.ClassicPtr:
      case WowClientType.ClassicBeta:
        return "wrath";
      case WowClientType.Retail:
      case WowClientType.RetailPtr:
      case WowClientType.Beta:
        return "retail";
      default:
        return "";
    }
  }

  private mapAddonCategory(category: AddonCategory): string[] {
    switch (category) {
      case AddonCategory.Achievements:
        return ["Achievements"];
      case AddonCategory.ActionBars:
        return ["Action Bars"];
      case AddonCategory.BagsInventory:
        return ["Bags & Inventory"];
      case AddonCategory.BuffsDebuffs:
        return ["Buffs & Debuffs"];
      case AddonCategory.Bundles:
        return ["Edited UIs & Compilations", "Full UI Replacements"];
      case AddonCategory.ChatCommunication:
        return ["Chat & Communication"];
      case AddonCategory.Class:
        return ["Class"];
      case AddonCategory.Combat:
        return ["Combat"];
      case AddonCategory.Guild:
        return ["Guild"];
      case AddonCategory.MapMinimap:
        return ["Map & Minimap"];
      case AddonCategory.Miscellaneous:
        return ["Miscellaneous"];
      case AddonCategory.Plugins:
        return ["Plugins: ElvUI", "Plugins: Tukui", "Plugins: Other", "Skins"];
      case AddonCategory.Professions:
        return ["Professions"];
      case AddonCategory.Roleplay:
        return ["Roleplay"];
      case AddonCategory.Tooltips:
        return ["Tooltips"];
      case AddonCategory.UnitFrames:
        return ["Unit Frames"];
      default:
        throw new Error("Unhandled addon category");
    }
  }
}
