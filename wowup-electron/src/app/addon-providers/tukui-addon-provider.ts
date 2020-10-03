import { HttpClient } from "@angular/common/http";
import { Addon } from "app/entities/addon";
import { TukUiAddon } from "app/models/tukui/tukui-addon";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { AddonChannelType } from "app/models/wowup/addon-channel-type";
import { AddonFolder } from "app/models/wowup/addon-folder";
import { AddonSearchResult } from "app/models/wowup/addon-search-result";
import { PotentialAddon } from "app/models/wowup/potential-addon";
import { CachingService } from "app/services/caching/caching-service";
import { ElectronService } from "app/services/electron/electron.service";
import { FileService } from "app/services/files/file.service";
import { from, Observable, of } from "rxjs";
import { AddonProvider } from "./addon-provider";
import * as _ from 'lodash';
import { AddonSearchResultFile } from "app/models/wowup/addon-search-result-file";
import { map } from "rxjs/operators";
import { v4 as uuidv4 } from 'uuid';

const API_URL = "https://www.tukui.org/api.php";
const CLIENT_API_URL = "https://www.tukui.org/client-api.php";
const CACHE_TIME = 10 * 60 * 1000;

export class TukUiAddonProvider implements AddonProvider {

  public readonly name = "TukUI";

  constructor(
    private _httpClient: HttpClient,
    private _cachingService: CachingService,
    private _electronService: ElectronService,
    private _fileService: FileService
  ) { }

  async getAll(clientType: WowClientType, addonIds: string[]): Promise<AddonSearchResult[]> {
    let results: AddonSearchResult[] = [];

    try {
      const addons = await this.getAllAddons(clientType);
      results = addons.filter(addon => _.some(addonIds, aid => aid === addon.id))
        .map(addon => this.toSearchResult(addon, ''));
    } catch (err) {
      // _analyticsService.Track(ex, "Failed to search TukUi");
    }

    return results;
  }

  getFeaturedAddons(clientType: WowClientType): Observable<PotentialAddon[]> {
    return from(this.getAllAddons(clientType))
      .pipe(
        map(tukUiAddons => {
          return tukUiAddons.map(addon => this.toPotentialAddon(addon));
        })
      );
  }

  async searchByQuery(query: string, clientType: WowClientType): Promise<PotentialAddon[]> {
    const addons = await this.getAllAddons(clientType);
    const canonQuery = query.toLowerCase();
    let similarAddons = _.filter(addons, addon => addon.name.toLowerCase().indexOf(canonQuery) !== -1);
    similarAddons = _.orderBy(similarAddons, ['downloads']);

    return _.map(similarAddons, addon => this.toPotentialAddon(addon));
  }

  searchByUrl(addonUri: URL, clientType: WowClientType): Promise<PotentialAddon> {
    throw new Error("Method not implemented.");
  }

  async searchByName(addonName: string, folderName: string, clientType: WowClientType, nameOverride?: string): Promise<AddonSearchResult[]> {
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
    return from(this.getAllAddons(clientType))
      .pipe(
        map(addons => {
          const match = _.find(addons, addon => addon.id === addonId);
          return this.toSearchResult(match, '');
        })
      )
  }

  isValidAddonUri(addonUri: URL): boolean {
    return false;
  }

  onPostInstall(addon: Addon): void {
  }

  async scan(clientType: WowClientType, addonChannelType: AddonChannelType, addonFolders: AddonFolder[]): Promise<void> {
    const allAddons = await this.getAllAddons(clientType);
    for (let addonFolder of addonFolders) {
      let tukUiAddon: TukUiAddon;
      if (addonFolder.toc?.tukUiProjectId) {
        tukUiAddon = _.find(allAddons, addon => addon.id.toString() === addonFolder.toc.tukUiProjectId);
      } else {
        const results = await this.searchAddons(addonFolder.toc.title, clientType);
        tukUiAddon = _.first(results);
      }

      if (tukUiAddon) {
        addonFolder.matchingAddon = {
          autoUpdateEnabled: false,
          channelType: addonChannelType,
          clientType: clientType,
          folderName: addonFolder.name,
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
          updatedAt: new Date()
        }
      }
    }
  }

  private async searchAddons(addonName: string, clientType: WowClientType) {
    var addons = await this.getAllAddons(clientType);
    return addons
      .filter(addon => addon.name.toLowerCase() === addonName.toLowerCase());
  }

  private toPotentialAddon(addon: TukUiAddon): PotentialAddon {
    return {
      author: addon.author,
      downloadCount: parseInt(addon.downloads, 10),
      externalId: addon.id,
      externalUrl: addon.web_url,
      name: addon.name,
      providerName: this.name,
      thumbnailUrl: addon.screenshot_url,
      summary: addon.small_desc
    };
  }

  private toSearchResult(addon: TukUiAddon, folderName: string): AddonSearchResult | undefined {
    if (!addon) {
      return undefined;
    }

    var latestFile: AddonSearchResultFile = {
      channelType: AddonChannelType.Stable,
      folders: [folderName],
      downloadUrl: addon.url,
      gameVersion: addon.patch,
      version: addon.version,
      releaseDate: new Date(addon.lastUpdate)
    };

    return {
      author: addon.author,
      externalId: addon.id,
      name: addon.name,
      thumbnailUrl: addon.screenshot_url,
      externalUrl: addon.web_url,
      providerName: this.name,
      files: [latestFile]
    };
  }

  private async getAllAddons(clientType: WowClientType): Promise<TukUiAddon[]> {
    if(clientType === WowClientType.None){
      return [];
    }

    const cacheKey = this.getCacheKey(clientType);
    const cachedAddons = this._cachingService.get<TukUiAddon[]>(cacheKey);
    if (cachedAddons) {
      return cachedAddons;
    }

    try {
      const query = this.getAddonsSuffix(clientType);
      const url = new URL(API_URL);
      url.searchParams.append(query, 'all');

      const addons = await this._httpClient.get<TukUiAddon[]>(url.toString()).toPromise();
      if (this.isRetail(clientType)) {
        addons.push(await this.getTukUiRetailAddon().toPromise());
        addons.push(await this.getElvUiRetailAddon().toPromise());
      }

      console.log('CACHED')
      this._cachingService.set(cacheKey, addons, CACHE_TIME);
      return addons;
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  private getTukUiRetailAddon() {
    return this.getClientApiAddon('tukui');
  }

  private getElvUiRetailAddon() {
    return this.getClientApiAddon('elvui');
  }

  private getClientApiAddon(addonName: string): Observable<TukUiAddon> {
    const url = new URL(CLIENT_API_URL);
    url.searchParams.append('ui', addonName);

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
        return '';
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
        return '';
    }
  }
}
