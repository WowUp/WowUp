import { HttpClient } from "@angular/common/http";
import * as _ from "lodash";
import * as CircuitBreaker from "opossum";
import { from, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";
import { Addon } from "../entities/addon";
import { TukUiAddon } from "../models/tukui/tukui-addon";
import { WowClientType } from "../models/warcraft/wow-client-type";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonFolder } from "../models/wowup/addon-folder";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";
import { CachingService } from "../services/caching/caching-service";
import { ElectronService } from "../services/electron/electron.service";
import { FileService } from "../services/files/file.service";
import { AddonProvider } from "./addon-provider";
import { AppConfig } from "../../environments/environment";

// const API_URL = "https://www.tukui.org/api.php";
// const CLIENT_API_URL = "https://www.tukui.org/client-api.php";
const WOWUP_API_URL = AppConfig.wowUpHubUrl;

export class TukUiAddonProvider implements AddonProvider {
  private readonly _circuitBreaker: CircuitBreaker<[clientType: WowClientType], TukUiAddon[]>;

  public readonly name = "TukUI";

  constructor(
    private _httpClient: HttpClient,
    private _cachingService: CachingService,
    private _electronService: ElectronService,
    private _fileService: FileService
  ) {
    this._circuitBreaker = new CircuitBreaker(this.fetchApiResultsWowUp, {
      resetTimeout: 60000,
    });

    this._circuitBreaker.on("open", () => {
      console.log(`${this.name} circuit breaker open`);
    });
    this._circuitBreaker.on("close", () => {
      console.log(`${this.name} circuit breaker close`);
    });
  }

  async getAll(clientType: WowClientType, addonIds: string[]): Promise<AddonSearchResult[]> {
    let results: AddonSearchResult[] = [];

    try {
      const addons = await this.getAllAddons(clientType);
      results = addons
        .filter((addon) => _.some(addonIds, (aid) => aid.toString() === addon.id.toString()))
        .map((addon) => this.toSearchResult(addon, ""));
    } catch (err) {
      // _analyticsService.Track(ex, "Failed to search TukUi");
    }

    return results;
  }

  public async getFeaturedAddons(clientType: WowClientType): Promise<AddonSearchResult[]> {
    const tukUiAddons = await this.getAllAddons(clientType);
    return tukUiAddons.map((addon) => this.toSearchResult(addon));
  }

  async searchByQuery(query: string, clientType: WowClientType): Promise<AddonSearchResult[]> {
    const addons = await this.getAllAddons(clientType);
    const canonQuery = query.toLowerCase();
    let similarAddons = _.filter(addons, (addon) => addon.name.toLowerCase().indexOf(canonQuery) !== -1);
    similarAddons = _.orderBy(similarAddons, ["downloads"]);

    return _.map(similarAddons, (addon) => this.toSearchResult(addon));
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
      const searchResult = this.toSearchResult(_.first(addons), folderName);
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
      map((addons) => {
        const match = _.find(addons, (addon) => addon.id === addonId);
        return this.toSearchResult(match, "");
      })
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
          externalId: tukUiAddon.id.toString(),
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
        };
      }
    }
  }

  private async searchAddons(addonName: string, clientType: WowClientType) {
    var addons = await this.getAllAddons(clientType);
    return addons.filter((addon) => addon.name.toLowerCase() === addonName.toLowerCase());
  }

  private toSearchResult(addon: TukUiAddon, folderName?: string): AddonSearchResult | undefined {
    if (!addon) {
      return undefined;
    }

    var latestFile: AddonSearchResultFile = {
      channelType: AddonChannelType.Stable,
      folders: folderName ? [folderName] : [],
      downloadUrl: addon.url,
      gameVersion: addon.patch,
      version: addon.version,
      releaseDate: new Date(`${addon.lastupdate} UTC`),
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
    const url = new URL(`${WOWUP_API_URL}/tukui/addons/client/${clientTypeName}`);

    const addons = await this._httpClient.get<TukUiAddon[]>(url.toString()).toPromise();
    // if (this.isRetail(clientType)) {
    //   addons.push(await this.getTukUiRetailAddon().toPromise());
    //   addons.push(await this.getElvUiRetailAddon().toPromise());
    // }
    console.debug("WowUpTukui", addons);

    return addons;
  };

  // private fetchApiResults = async (clientType: WowClientType) => {
  //   const query = this.getAddonsSuffix(clientType);
  //   const url = new URL(API_URL);
  //   url.searchParams.append(query, "all");

  //   const addons = await this._httpClient.get<TukUiAddon[]>(url.toString()).toPromise();
  //   if (this.isRetail(clientType)) {
  //     addons.push(await this.getTukUiRetailAddon().toPromise());
  //     addons.push(await this.getElvUiRetailAddon().toPromise());
  //   }

  //   return addons;
  // };

  // private getTukUiRetailAddon() {
  //   return this.getClientApiAddon("tukui");
  // }

  // private getElvUiRetailAddon() {
  //   return this.getClientApiAddon("elvui");
  // }

  // private getClientApiAddon(addonName: string): Observable<TukUiAddon> {
  //   const url = new URL(CLIENT_API_URL);
  //   url.searchParams.append("ui", addonName);

  //   return this._httpClient.get<TukUiAddon>(url.toString());
  // }

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
