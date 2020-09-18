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

const API_URL = "https://www.tukui.org/api.php";
const CLIENT_API_URL = "https://www.tukui.org/client-api.php";
const CACHE_TIME = 10 * 60 * 1000;

export class TukUiAddonProvider implements AddonProvider {

  public readonly name = "Curse";

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
          
        })
      );
  }
  searchByQuery(query: string, clientType: WowClientType): Promise<PotentialAddon[]> {
    throw new Error("Method not implemented.");
  }
  searchByUrl(addonUri: URL, clientType: WowClientType): Promise<PotentialAddon> {
    throw new Error("Method not implemented.");
  }
  searchByName(addonName: string, folderName: string, clientType: WowClientType, nameOverride?: string): Promise<AddonSearchResult[]> {
    throw new Error("Method not implemented.");
  }
  getById(addonId: string, clientType: WowClientType): Observable<AddonSearchResult> {
    throw new Error("Method not implemented.");
  }
  isValidAddonUri(addonUri: URL): boolean {
    throw new Error("Method not implemented.");
  }
  onPostInstall(addon: Addon): void {
    throw new Error("Method not implemented.");
  }
  scan(clientType: WowClientType, addonChannelType: AddonChannelType, addonFolders: AddonFolder[]): Promise<void> {
    throw new Error("Method not implemented.");
  }

  private toPotentialAddon(addon: TukUiAddon): PotentialAddon {
    return {
      author: addon.author,
      downloadCount: parseInt(addon.downloads, 10),
      externalId: addon.id,
      externalUrl: addon.web_url,
      name: addon.name,
      providerName: this.name,
      thumbnailUrl: addon.screenshot_url
    };
  }

  private toSearchResult(addon: TukUiAddon, folderName: string): AddonSearchResult {
    var latestFile: AddonSearchResultFile = {
      channelType: AddonChannelType.Stable,
      folders: [folderName],
      downloadUrl: addon.url,
      gameVersion: addon.patch,
      version: addon.version
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