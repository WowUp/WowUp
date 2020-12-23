import { HttpClient } from "@angular/common/http";
import { ADDON_PROVIDER_TUKUI } from "../../common/constants";
import * as _ from "lodash";
import * as CircuitBreaker from "opossum";
import { from, Observable } from "rxjs";
import { map, switchMap, timeout } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";
import { Addon } from "../entities/addon";
import { TukUiAddon } from "../models/tukui/tukui-addon";
import { WowClientType } from "../models/warcraft/wow-client-type";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonFolder } from "../models/wowup/addon-folder";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";
import { CachingService } from "../services/caching/caching-service";
import { NetworkService } from "../services/network/network.service";
import { AddonProvider } from "./addon-provider";
import { AppConfig } from "../../environments/environment";

const API_URL = "https://www.tukui.org/api.php";
const CLIENT_API_URL = "https://www.tukui.org/client-api.php";
const WOWUP_API_URL = AppConfig.wowUpHubUrl;
const CHANGELOG_FETCH_TIMEOUT_MS = 1500;
const CHANGELOG_CACHE_TTL_MS = 30 * 60 * 1000;

export class TukUiAddonProvider implements AddonProvider {
  private readonly _circuitBreaker: CircuitBreaker<[clientType: WowClientType], TukUiAddon[]>;
  private readonly _changelogCircuitBreaker: CircuitBreaker<[clientType: TukUiAddon], string>;

  public readonly name = ADDON_PROVIDER_TUKUI;
  public readonly forceIgnore = false;
  public readonly allowReinstall = true;
  public readonly allowChannelChange = false;
  public readonly allowEdit = true;
  public enabled = true;

  constructor(
    private _httpClient: HttpClient,
    private _cachingService: CachingService,
    private _networkService: NetworkService
  ) {
    this._circuitBreaker = this._networkService.getCircuitBreaker<[clientType: WowClientType], TukUiAddon[]>(
      `${this.name}_main`,
      this.fetchApiResults
    );

    this._changelogCircuitBreaker = this._networkService.getCircuitBreaker<[clientType: TukUiAddon], string>(
      `${this.name}_changelog`,
      this.fetchChangelogHtml
    );
  }

  public async getChangelog(addon: Addon): Promise<string> {
    return addon.latestChangelog || "";
  }

  async getAll(clientType: WowClientType, addonIds: string[]): Promise<AddonSearchResult[]> {
    let results: AddonSearchResult[] = [];

    try {
      const addons = await this.getAllAddons(clientType);
      const filteredAddons = addons.filter((addon) => _.some(addonIds, (aid) => aid === addon.id));
      results = await this.mapAddonsToSearchResults(filteredAddons);
    } catch (err) {
      // _analyticsService.Track(ex, "Failed to search TukUi");
    }

    return results;
  }

  public async getFeaturedAddons(clientType: WowClientType): Promise<AddonSearchResult[]> {
    const tukUiAddons = await this.getAllAddons(clientType);
    return await this.mapAddonsToSearchResults(tukUiAddons);
  }

  async searchByQuery(query: string, clientType: WowClientType): Promise<AddonSearchResult[]> {
    const addons = await this.getAllAddons(clientType);
    const canonQuery = query.toLowerCase();
    let similarAddons = _.filter(addons, (addon) => addon.name.toLowerCase().indexOf(canonQuery) !== -1);
    similarAddons = _.orderBy(similarAddons, ["downloads"]);

    return await this.mapAddonsToSearchResults(similarAddons);
  }

  searchByUrl(addonUri: URL, clientType: WowClientType): Promise<AddonSearchResult> {
    throw new Error("Method not implemented.");
  }

  async searchByName(
    addonName: string,
    folderName: string,
    clientType: WowClientType,
    nameOverride?: string
  ): Promise<AddonSearchResult[]> {
    const results: AddonSearchResult[] = [];
    try {
      const addons = await this.searchAddons(addonName, clientType);
      const searchResult = await this.toSearchResult(_.first(addons), folderName);
      if (searchResult) {
        results.push(searchResult);
      }
    } catch (err) {
      console.error(err);
    }

    return results;
  }

  getById(addonId: string, clientType: WowClientType): Observable<AddonSearchResult | undefined> {
    return from(this.getAllAddons(clientType)).pipe(
      map((addons) => _.find(addons, (addon) => addon.id === addonId)),
      switchMap((match) => from(this.toSearchResult(match, "")))
    );
  }

  isValidAddonUri(addonUri: URL): boolean {
    return false;
  }

  isValidAddonId(addonId: string): boolean {
    return !!addonId && !isNaN(parseInt(addonId, 10));
  }

  onPostInstall(addon: Addon): void {}

  async scan(
    clientType: WowClientType,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {
    const allAddons = await this.getAllAddons(clientType);
    for (let addonFolder of addonFolders) {
      let tukUiAddon: TukUiAddon;
      if (addonFolder.toc?.tukUiProjectId) {
        tukUiAddon = _.find(allAddons, (addon) => addon.id.toString() === addonFolder.toc.tukUiProjectId);
      } else {
        const results = await this.searchAddons(addonFolder.toc.title, clientType);
        tukUiAddon = _.first(results);
      }

      if (tukUiAddon) {
        addonFolder.matchingAddon = {
          autoUpdateEnabled: false,
          channelType: addonChannelType,
          clientType: clientType,
          id: uuidv4(),
          isIgnored: false,
          name: tukUiAddon.name,
          author: tukUiAddon.author,
          downloadUrl: tukUiAddon.url,
          externalId: tukUiAddon.id,
          externalUrl: tukUiAddon.web_url,
          gameVersion: tukUiAddon.patch,
          installedAt: new Date(),
          installedFolders: addonFolder.name,
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
        return await this._changelogCircuitBreaker.fire(addon);
      } catch (e) {
        console.error("Failed to get changelog", e);
      }
    }

    return `<a href="${addon.changelog}">${addon.changelog}</a>`;
  }

  private fetchChangelogHtml = async (addon: TukUiAddon): Promise<string> => {
    const cacheKey = `tukui_changelog_${addon.id}`;
    const cachedChangelog = this._cachingService.get<string>(cacheKey);
    if (cachedChangelog) {
      return cachedChangelog;
    }

    const html = await this._httpClient
      .get(addon.changelog, { responseType: "text" })
      .pipe(timeout(CHANGELOG_FETCH_TIMEOUT_MS))
      .toPromise();

    this._cachingService.set(cacheKey, html, CHANGELOG_CACHE_TTL_MS);

    return html;
  };

  private async searchAddons(addonName: string, clientType: WowClientType) {
    var addons = await this.getAllAddons(clientType);
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
      gameVersion: addon.patch,
      version: addon.version,
      releaseDate: new Date(`${addon.lastupdate} UTC`),
      changelog: await this.formatChangelog(addon),
    };

    return {
      author: addon.author,
      externalId: addon.id,
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

    const cacheKey = this.getCacheKey(clientType);
    const cachedAddons = this._cachingService.get<TukUiAddon[]>(cacheKey);
    if (cachedAddons) {
      return cachedAddons;
    }

    try {
      const addons = await this._circuitBreaker.fire(clientType);

      this._cachingService.set(cacheKey, addons);
      return addons;
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  private fetchApiResultsWowUp = async (clientType: WowClientType) => {
    const clientTypeName = this.getAddonsSuffixWowUp(clientType);
    const url = new URL(`${WOWUP_API_URL}/tukui/${clientTypeName}`);

    const addons = await this._httpClient.get<TukUiAddon[]>(url.toString()).toPromise();
    console.debug("WowUpTukui", addons);

    return addons;
  };

  private fetchApiResults = async (clientType: WowClientType) => {
    const query = this.getAddonsSuffix(clientType);
    const url = new URL(API_URL);
    url.searchParams.append(query, "all");

    const addons = await this._httpClient.get<TukUiAddon[]>(url.toString()).toPromise();
    if (this.isRetail(clientType)) {
      addons.push(await this.getTukUiRetailAddon().toPromise());
      addons.push(await this.getElvUiRetailAddon().toPromise());
    }

    return addons;
  };

  private getTukUiRetailAddon() {
    return this.getClientApiAddon("tukui");
  }

  private getElvUiRetailAddon() {
    return this.getClientApiAddon("elvui");
  }

  private getClientApiAddon(addonName: string): Observable<TukUiAddon> {
    const url = new URL(CLIENT_API_URL);
    url.searchParams.append("ui", addonName);

    return this._httpClient.get<TukUiAddon>(url.toString());
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

  private getCacheKey(clientType: WowClientType) {
    switch (clientType) {
      case WowClientType.Classic:
      case WowClientType.ClassicPtr:
        return "tukui_classic_addons";
      case WowClientType.Retail:
      case WowClientType.RetailPtr:
      case WowClientType.Beta:
        return "tukui_addons";
      default:
        return "";
    }
  }
}
