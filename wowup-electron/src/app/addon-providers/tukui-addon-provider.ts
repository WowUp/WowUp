import * as _ from "lodash";
import { from, Observable } from "rxjs";
import { map, switchMap } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";

import { ADDON_PROVIDER_TUKUI } from "../../common/constants";
import { WowClientType } from "../../common/warcraft/wow-client-type";
import { AddonChannelType } from "../../common/wowup/models";
import { TukUiAddon } from "../models/tukui/tukui-addon";
import { AddonFolder } from "../models/wowup/addon-folder";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";
import { WowInstallation } from "../models/wowup/wow-installation";
import { CachingService } from "../services/caching/caching-service";
import { CircuitBreakerWrapper, NetworkService } from "../services/network/network.service";
import { getGameVersion } from "../utils/addon.utils";
import { getEnumName } from "../utils/enum.utils";
import { AddonProvider, GetAllResult } from "./addon-provider";

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

  public constructor(private _cachingService: CachingService, private _networkService: NetworkService) {
    super();
    this._circuitBreaker = this._networkService.getCircuitBreaker(`${this.name}_main`);
  }

  public async getDescription(installation: WowInstallation, externalId: string): Promise<string> {
    const addons = await this.getAllAddons(installation.clientType);
    const addonMatch = _.find(addons, (addon) => addon.id.toString() === externalId.toString());
    return addonMatch.small_desc;
  }

  public async getChangelog(installation: WowInstallation, externalId: string): Promise<string> {
    const addons = await this.getAllAddons(installation.clientType);
    const addon = _.find(addons, (addon) => addon.id.toString() === externalId.toString());
    return await this.formatChangelog(addon);
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
    const addons = await this.getAllAddons(installation.clientType);
    const canonQuery = query.toLowerCase();
    let similarAddons = _.filter(addons, (addon) => addon.name.toLowerCase().indexOf(canonQuery) !== -1);
    similarAddons = _.orderBy(similarAddons, ["downloads"]);

    return await this.mapAddonsToSearchResults(similarAddons);
  }

  public async searchByName(
    addonName: string,
    folderName: string,
    installation: WowInstallation
  ): Promise<AddonSearchResult[]> {
    const results: AddonSearchResult[] = [];
    try {
      const addons = await this.searchAddons(addonName, installation.clientType);
      const searchResult = await this.toSearchResult(_.first(addons), folderName);
      if (searchResult) {
        results.push(searchResult);
      }
    } catch (err) {
      console.error(err);
    }

    return results;
  }

  public getById(addonId: string, installation: WowInstallation): Observable<AddonSearchResult | undefined> {
    return from(this.getAllAddons(installation.clientType)).pipe(
      map((addons) => _.find(addons, (addon) => addon.id === addonId)),
      switchMap((match) => from(this.toSearchResult(match, "")))
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
    for (const addonFolder of addonFolders) {
      let tukUiAddon: TukUiAddon;
      if (addonFolder.toc?.tukUiProjectId) {
        tukUiAddon = _.find(allAddons, (addon) => addon.id.toString() === addonFolder.toc.tukUiProjectId);
      } else {
        const results = await this.searchAddons(addonFolder.toc.title, installation.clientType);
        tukUiAddon = _.first(results);
      }

      if (tukUiAddon) {
        addonFolder.matchingAddon = {
          autoUpdateEnabled: false,
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
          installedAt: addonFolder.fileStats.birthtime,
          installedFolders: addonFolder.name,
          installedFolderList: [addonFolder.name],
          installedVersion: addonFolder.toc.version,
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
  }

  private async mapAddonsToSearchResults(addons: TukUiAddon[]) {
    const results: AddonSearchResult[] = [];
    for (const addon of addons) {
      const searchResult = await this.toSearchResult(addon, "");
      results.push(searchResult);
    }
    return results;
  }

  private async formatChangelog(addon: TukUiAddon) {
    if (["-1", "-2"].includes(addon.id.toString())) {
      try {
        return await this.fetchChangelogHtml(addon);
      } catch (e) {
        console.error("Failed to get changelog", e);
      }
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

  private async searchAddons(addonName: string, clientType: WowClientType) {
    const addons = await this.getAllAddons(clientType);
    return addons.filter((addon) => addon.name.toLowerCase() === addonName.toLowerCase());
  }

  private async toSearchResult(addon: TukUiAddon, folderName?: string): Promise<AddonSearchResult | undefined> {
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
      const cacheKey = `${this.name}_all_addons_${this.getAddonsSuffixWowUp(clientType)}`;
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
      case WowClientType.Classic:
      case WowClientType.ClassicPtr:
        return "classic-addons";
      case WowClientType.Retail:
      case WowClientType.RetailPtr:
      case WowClientType.Beta:
        return "addons";
      default:
        return "";
    }
  }

  private getAddonsSuffixWowUp(clientType: WowClientType) {
    switch (clientType) {
      case WowClientType.Classic:
      case WowClientType.ClassicPtr:
        return "classic";
      case WowClientType.Retail:
      case WowClientType.RetailPtr:
      case WowClientType.Beta:
        return "retail";
      default:
        return "";
    }
  }
}
