import { AddonProvider } from "./addon-provider";
import { WowClientType } from "../models/warcraft/wow-client-type";
import { Addon } from "../entities/addon";
import { HttpClient } from "@angular/common/http";
import { CurseSearchResult } from "../models/curse/curse-search-result";
import { map } from "rxjs/operators";
import { CurseFile } from "../models/curse/curse-file";
import * as _ from 'lodash';
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { Observable, of } from "rxjs";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";
import { CurseReleaseType } from "../models/curse/curse-release-type";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { PotentialAddon } from "../models/wowup/potential-addon";
import { CurseGetFeaturedResponse } from "../models/curse/curse-get-featured-response";
import { CachingService } from "app/services/caching/caching-service";

const API_URL = "https://addons-ecs.forgesvc.net/api/v2";

export class CurseAddonProvider implements AddonProvider {

  private readonly _httpClient: HttpClient;

  public readonly name = "Curse";

  constructor(
    httpClient: HttpClient,
    private _cachingService: CachingService
  ) {
    this._httpClient = httpClient;
  }

  getAll(clientType: WowClientType, addonIds: string[]): Promise<import("../models/wowup/addon-search-result").AddonSearchResult[]> {
    throw new Error("Method not implemented.");
  }

  getFeaturedAddons(clientType: WowClientType): Observable<PotentialAddon[]> {
    return this.getFeaturedAddonList()
      .pipe(
        map(addons => {
          return this.filterFeaturedAddons(addons, clientType);
        }),
        map(filteredAddons => {
          return filteredAddons.map(addon => this.getPotentialAddon(addon));
        })
      );
  }

  private filterFeaturedAddons(results: CurseSearchResult[], clientType: WowClientType) {
    const clientTypeStr = this.getClientTypeString(clientType);

    return results.filter(r => r.latestFiles.some(lf => this.isClientType(lf, clientTypeStr)));
  }

  private isClientType(file: CurseFile, clientTypeStr: string) {
    return file.releaseType === CurseReleaseType.Release &&
      file.gameVersionFlavor === clientTypeStr &&
      file.isAlternate === false;
  }

  searchByQuery(query: string, clientType: WowClientType): Promise<import("../models/wowup/potential-addon").PotentialAddon[]> {
    throw new Error("Method not implemented.");
  }

  searchByUrl(addonUri: URL, clientType: WowClientType): Promise<import("../models/wowup/potential-addon").PotentialAddon> {
    throw new Error("Method not implemented.");
  }

  searchByName(addonName: string, folderName: string, clientType: WowClientType, nameOverride?: string): Promise<import("../models/wowup/addon-search-result").AddonSearchResult[]> {
    throw new Error("Method not implemented.");
  }

  getById(addonId: string, clientType: WowClientType): Promise<AddonSearchResult> {
    const url = `${API_URL}/addon/${addonId}`;

    return this._httpClient.get<CurseSearchResult>(url)
      .pipe(
        map(result => {
          if (!result) {
            return null;
          }

          const latestFiles = this.getLatestFiles(result, clientType);
          if (!latestFiles?.length) {
            return null;
          }

          return this.getAddonSearchResult(result, latestFiles);
        })
      )
      .toPromise();
  }

  isValidAddonUri(addonUri: URL): boolean {
    throw new Error("Method not implemented.");
  }

  onPostInstall(addon: Addon): void {
    throw new Error("Method not implemented.");
  }

  private getPotentialAddon(result: CurseSearchResult): PotentialAddon {
    return {
      author: this.getAuthor(result),
      downloadCount: result.downloadCount,
      externalId: result.id.toString(),
      externalUrl: result.websiteUrl,
      name: result.name,
      providerName: this.name,
      thumbnailUrl: this.getThumbnailUrl(result)
    };
  }

  private getAddonSearchResult(result: CurseSearchResult, latestFiles: CurseFile[]): AddonSearchResult {
    try {
      const thumbnailUrl = this.getThumbnailUrl(result);
      const id = result.id;
      const name = result.name;
      const author = this.getAuthor(result);

      const searchResultFiles: AddonSearchResultFile[] = latestFiles.map(lf => {
        return {
          channelType: this.getChannelType(lf.releaseType),
          version: lf.displayName,
          downloadUrl: lf.downloadUrl,
          folders: this.getFolderNames(lf),
          gameVersion: this.getGameVersion(lf)
        };
      });

      const searchResult: AddonSearchResult = {
        author,
        externalId: id.toString(),
        name,
        thumbnailUrl,
        externalUrl: result.websiteUrl,
        providerName: this.name,
        files: searchResultFiles
      };

      return searchResult;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  private getFeaturedAddonList(): Observable<CurseSearchResult[]> {
    const url = `${API_URL}/addon/featured`;
    const cachedResponse = this._cachingService.get<CurseGetFeaturedResponse>(url);
    if (cachedResponse) {
      return of(cachedResponse.Popular);
    }

    const body = {
      gameId: 1,
      featuredCount: 6,
      popularCount: 50,
      updatedCount: 0
    };

    return this._httpClient.post<CurseGetFeaturedResponse>(url, body)
      .pipe(
        map(result => {
          if (!result) {
            return [];
          }

          this._cachingService.set(url, result);

          return result.Popular;
        })
      );
  }

  private getChannelType(releaseType: CurseReleaseType): AddonChannelType {
    switch (releaseType) {
      case CurseReleaseType.Alpha:
        return AddonChannelType.Alpha;
      case CurseReleaseType.Beta:
        return AddonChannelType.Beta;
      case CurseReleaseType.Release:
      default:
        return AddonChannelType.Stable;
    }
  }

  private getFolderNames(file: CurseFile): string[] {
    return file.modules.map(m => m.foldername);
  }

  private getGameVersion(file: CurseFile): string {
    return _.first(file.gameVersion);
  }

  private getAuthor(result: CurseSearchResult): string {
    const authorNames = result.authors.map(a => a.name);
    return authorNames.join(', ');
  }

  private getThumbnailUrl(result: CurseSearchResult): string {
    const attachment = _.find(result.attachments, f => f.isDefault && !!f.thumbnailUrl);
    return attachment?.thumbnailUrl;
  }

  private getLatestFiles(result: CurseSearchResult, clientType: WowClientType): CurseFile[] {
    const clientTypeStr = this.getClientTypeString(clientType);

    return _.flow(
      _.filter((f: CurseFile) => f.isAlternate == false && f.gameVersionFlavor == clientTypeStr),
      _.orderBy((f: CurseFile) => f.id),
      _.reverse
    )(result.latestFiles) as CurseFile[];
  }

  private getClientTypeString(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Classic:
      case WowClientType.ClassicPtr:
        return "wow_classic";
      case WowClientType.Retail:
      case WowClientType.RetailPtr:
      case WowClientType.Beta:
      default:
        return "wow_retail";
    }
  }

}