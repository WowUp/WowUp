import { AddonProvider } from "./addon-provider";
import { WowClientType } from "../models/warcraft/wow-client-type";
import { Addon } from "../entities/addon";
import { HttpClient } from "@angular/common/http";
import { map } from "rxjs/operators";
import * as _ from "lodash";
import * as fp from "lodash/fp";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { Observable, of } from "rxjs";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { PotentialAddon } from "../models/wowup/potential-addon";
import { CachingService } from "app/services/caching/caching-service";
import { AddonFolder } from "app/models/wowup/addon-folder";
import { ElectronService } from "app/services";
import { AppCurseScanResult } from "../models/curse/app-curse-scan-result";
import { v4 as uuidv4 } from "uuid";
import { CURSE_GET_SCAN_RESULTS } from "common/constants";
import { CurseGetScanResultsRequest } from "common/curse/curse-get-scan-results-request";
import { CurseGetScanResultsResponse } from "common/curse/curse-get-scan-results-response";
import { CurseMatch } from "common/curse/curse-match";
import { CurseFingerprintsResponse } from "../models/curse/curse-fingerprint-response";
import { CurseSearchResult } from "../models/curse/curse-search-result";
import { CurseFile } from "common/curse/curse-file";
import { CurseReleaseType } from "common/curse/curse-release-type";
import { CurseGetFeaturedResponse } from "app/models/curse/curse-get-featured-response";

const API_URL = "https://addons-ecs.forgesvc.net/api/v2";

export class CurseAddonProvider implements AddonProvider {
  public readonly name = "Curse";

  constructor(
    private _httpClient: HttpClient,
    private _cachingService: CachingService,
    private _electronService: ElectronService
  ) {}

  async scan(
    clientType: WowClientType,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {
    if (!addonFolders.length) {
      return;
    }

    const scanResults = await this.getScanResults(addonFolders);

    console.log("ScanResults", scanResults.length);

    await this.mapAddonFolders(scanResults, clientType);

    console.log("mapAddonFolders");

    const addonIds = fp.flow(
      fp.filter((sr: AppCurseScanResult) => !!sr.exactMatch),
      fp.map((sr: AppCurseScanResult) => sr.exactMatch.id),
      fp.uniq
    )(scanResults);

    var addonResults = await this.getAllIds(addonIds).toPromise();

    for (let addonFolder of addonFolders) {
      var scanResult = scanResults.find(
        (sr) => sr.addonFolder.name === addonFolder.name
      );
      if (!scanResult.exactMatch) {
        continue;
      }

      scanResult.searchResult = addonResults.find(
        (addonResult) => addonResult.id === scanResult.exactMatch.id
      );
      if (!scanResult.searchResult) {
        continue;
      }

      try {
        addonFolder.matchingAddon = this.getAddon(
          clientType,
          addonChannelType,
          scanResult
        );
      } catch (err) {
        // TODO
        // _analyticsService.Track(ex, $"Failed to create addon for result {scanResult.FolderScanner.Fingerprint}");
      }
    }
  }

  private async mapAddonFolders(
    scanResults: AppCurseScanResult[],
    clientType: WowClientType
  ) {
    const fingerprintResponse = await this.getAddonsByFingerprints(
      scanResults.map((result) => result.fingerprint)
    ).toPromise();

    console.log(fingerprintResponse);

    for (let scanResult of scanResults) {
      // Curse can deliver the wrong result sometimes, ensure the result matches the client type
      scanResult.exactMatch = fingerprintResponse.exactMatches.find(
        (exactMatch) =>
          this.isGameVersionFlavor(
            exactMatch.file.gameVersionFlavor,
            clientType
          ) && this.hasMatchingFingerprint(scanResult, exactMatch)
      );

      // If the addon does not have an exact match, check the partial matches.
      if (!scanResult.exactMatch) {
        scanResult.exactMatch = fingerprintResponse.partialMatches.find(
          (partialMatch) =>
            partialMatch.file.modules.some(
              (module) => module.fingerprint === scanResult.fingerprint
            )
        );
      }
    }
  }

  private hasMatchingFingerprint(
    scanResult: AppCurseScanResult,
    exactMatch: CurseMatch
  ) {
    return exactMatch.file.modules.some(
      (m) => m.fingerprint === scanResult.fingerprint
    );
  }

  private isGameVersionFlavor(
    gameVersionFlavor: string,
    clientType: WowClientType
  ) {
    return gameVersionFlavor === this.getGameVersionFlavor(clientType);
  }

  private getAddonsByFingerprints(
    fingerprints: number[]
  ): Observable<CurseFingerprintsResponse> {
    const url = `${API_URL}/fingerprint`;

    return this._httpClient.post<CurseFingerprintsResponse>(url, fingerprints);
  }

  private getAllIds(addonIds: number[]): Observable<CurseSearchResult[]> {
    if (!addonIds?.length) {
      return of([]);
    }

    const url = `${API_URL}/addon`;

    return this._httpClient.post<CurseSearchResult[]>(url, addonIds);
  }

  private getScanResults = async (
    addonFolders: AddonFolder[]
  ): Promise<AppCurseScanResult[]> => {
    const t1 = Date.now();

    return new Promise((resolve, reject) => {
      const eventHandler = (_evt: any, arg: CurseGetScanResultsResponse) => {
        if (arg.error) {
          return reject(arg.error);
        }

        const appScanResults: AppCurseScanResult[] = arg.scanResults.map(
          (scanResult) => {
            const addonFolder = addonFolders.find(
              (af) => af.path === scanResult.directory
            );

            return Object.assign({}, scanResult, { addonFolder });
          }
        );

        console.log("scan delta", Date.now() - t1);
        resolve(appScanResults);
      };

      const request: CurseGetScanResultsRequest = {
        filePaths: addonFolders.map((addonFolder) => addonFolder.path),
        responseKey: uuidv4(),
      };

      this._electronService.ipcRenderer.once(request.responseKey, eventHandler);
      this._electronService.ipcRenderer.send(CURSE_GET_SCAN_RESULTS, request);
    });
  };

  async getAll(
    clientType: WowClientType,
    addonIds: string[]
  ): Promise<AddonSearchResult[]> {
    if (!addonIds.length) {
      return [];
    }

    const addonResults: AddonSearchResult[] = [];
    const searchResults = await this.getAllIds(
      addonIds.map((id) => parseInt(id, 10))
    ).toPromise();

    for (let result of searchResults) {
      const latestFiles = this.getLatestFiles(result, clientType);
      if (!latestFiles.length) {
        continue;
      }

      const addonSearchResult = this.getAddonSearchResult(result, latestFiles);
      if (addonSearchResult) {
        addonResults.push(addonSearchResult);
      }
    }

    return addonResults;
  }

  getFeaturedAddons(clientType: WowClientType): Observable<PotentialAddon[]> {
    return this.getFeaturedAddonList().pipe(
      map((addons) => {
        return this.filterFeaturedAddons(addons, clientType);
      }),
      map((filteredAddons) => {
        return filteredAddons.map((addon) => this.getPotentialAddon(addon));
      })
    );
  }

  private filterFeaturedAddons(
    results: CurseSearchResult[],
    clientType: WowClientType
  ) {
    const clientTypeStr = this.getGameVersionFlavor(clientType);

    return results.filter((r) =>
      r.latestFiles.some((lf) => this.isClientType(lf, clientTypeStr))
    );
  }

  private isClientType(file: CurseFile, clientTypeStr: string) {
    return (
      file.releaseType === CurseReleaseType.Release &&
      file.gameVersionFlavor === clientTypeStr &&
      file.isAlternate === false
    );
  }

  async searchByQuery(
    query: string,
    clientType: WowClientType
  ): Promise<PotentialAddon[]> {
    var searchResults: PotentialAddon[] = [];

    var response = await this.getSearchResults(query).toPromise();
    for (let result of response) {
      var latestFiles = this.getLatestFiles(result, clientType);
      if (!latestFiles.length) {
        continue;
      }

      searchResults.push(this.getPotentialAddon(result));
    }

    return searchResults;
  }

  searchByUrl(
    addonUri: URL,
    clientType: WowClientType
  ): Promise<PotentialAddon> {
    throw new Error("Method not implemented.");
  }

  searchByName(
    addonName: string,
    folderName: string,
    clientType: WowClientType,
    nameOverride?: string
  ): Promise<AddonSearchResult[]> {
    throw new Error("Method not implemented.");
  }

  private getSearchResults(query: string): Observable<CurseSearchResult[]> {
    const url = new URL(`${API_URL}/addon/search`);
    url.searchParams.set("gameId", "1");
    url.searchParams.set("searchFilter", query);

    return this._httpClient.get<CurseSearchResult[]>(url.toString());
  }

  getById(
    addonId: string,
    clientType: WowClientType
  ): Observable<AddonSearchResult> {
    const url = `${API_URL}/addon/${addonId}`;

    return this._httpClient.get<CurseSearchResult>(url).pipe(
      map((result) => {
        if (!result) {
          return null;
        }

        const latestFiles = this.getLatestFiles(result, clientType);
        if (!latestFiles?.length) {
          return null;
        }

        return this.getAddonSearchResult(result, latestFiles);
      })
    );
  }

  isValidAddonUri(addonUri: URL): boolean {
    return (
      addonUri.host &&
      addonUri.host.endsWith("curseforge.com") &&
      addonUri.pathname.startsWith("/wow/addons")
    );
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
      thumbnailUrl: this.getThumbnailUrl(result),
      summary: result.summary,
      screenshotUrls: this.getScreenshotUrls(result),
    };
  }

  private getAddonSearchResult(
    result: CurseSearchResult,
    latestFiles: CurseFile[]
  ): AddonSearchResult {
    try {
      const thumbnailUrl = this.getThumbnailUrl(result);
      const id = result.id;
      const name = result.name;
      const author = this.getAuthor(result);

      const searchResultFiles: AddonSearchResultFile[] = latestFiles.map(
        (lf) => {
          return {
            channelType: this.getChannelType(lf.releaseType),
            version: lf.displayName,
            downloadUrl: lf.downloadUrl,
            folders: this.getFolderNames(lf),
            gameVersion: this.getGameVersion(lf),
            releaseDate: new Date(lf.fileDate),
          };
        }
      );

      const searchResult: AddonSearchResult = {
        author,
        externalId: id.toString(),
        name,
        thumbnailUrl,
        externalUrl: result.websiteUrl,
        providerName: this.name,
        files: searchResultFiles,
      };

      return searchResult;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  private getFeaturedAddonList(): Observable<CurseSearchResult[]> {
    const url = `${API_URL}/addon/featured`;
    const cachedResponse = this._cachingService.get<CurseGetFeaturedResponse>(
      url
    );
    if (cachedResponse) {
      return of(cachedResponse.Popular);
    }

    const body = {
      gameId: 1,
      featuredCount: 6,
      popularCount: 50,
      updatedCount: 0,
    };

    return this._httpClient.post<CurseGetFeaturedResponse>(url, body).pipe(
      map((result) => {
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
    return file.modules.map((m) => m.foldername);
  }

  private getGameVersion(file: CurseFile): string {
    return _.first(file.gameVersion);
  }

  private getAuthor(result: CurseSearchResult): string {
    const authorNames = result.authors.map((a) => a.name);
    return authorNames.join(", ");
  }

  private getThumbnailUrl(result: CurseSearchResult): string {
    const attachment = result.attachments.find(
      (f) => f.isDefault && !!f.thumbnailUrl
    );
    return attachment?.thumbnailUrl;
  }

  private getScreenshotUrls(result: CurseSearchResult): string[] {
    return result.attachments.map((f) => f.url).filter(Boolean);
  }

  private getLatestFiles(
    result: CurseSearchResult,
    clientType: WowClientType
  ): CurseFile[] {
    const clientTypeStr = this.getGameVersionFlavor(clientType);
    const filtered = result.latestFiles.filter(
      (lf) => lf.isAlternate === false && lf.gameVersionFlavor === clientTypeStr
    );
    return _.sortBy(filtered, (lf) => lf.id).reverse();
  }

  private getGameVersionFlavor(clientType: WowClientType): string {
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

  private getAddon(
    clientType: WowClientType,
    addonChannelType: AddonChannelType,
    scanResult: AppCurseScanResult
  ): Addon {
    const currentVersion = scanResult.exactMatch.file;
    const authors = scanResult.searchResult.authors
      .map((author) => author.name)
      .join(", ");
    const folderList = scanResult.exactMatch.file.modules
      .map((module) => module.foldername)
      .join(",");
    const latestFiles = this.getLatestFiles(
      scanResult.searchResult,
      clientType
      );
    const latestVersion = latestFiles.find(
      (lf) => this.getChannelType(lf.releaseType) <= addonChannelType
    );

    return {
      id: uuidv4(),
      author: authors,
      name: scanResult.searchResult.name,
      channelType: addonChannelType,
      autoUpdateEnabled: false,
      clientType: clientType,
      downloadUrl: latestVersion.downloadUrl,
      externalUrl: scanResult.searchResult.websiteUrl,
      externalId: scanResult.searchResult.id.toString(),
      folderName: scanResult.addonFolder.name,
      gameVersion: currentVersion.gameVersion[0],
      installedAt: new Date(),
      installedFolders: folderList,
      installedVersion: currentVersion.displayName,
      isIgnored: false,
      latestVersion: latestVersion.displayName,
      providerName: this.name,
      thumbnailUrl: this.getThumbnailUrl(scanResult.searchResult),
      screenshotUrls: this.getScreenshotUrls(scanResult.searchResult),
      downloadCount: scanResult.searchResult.downloadCount,
      summary: scanResult.searchResult.summary,
    };
  }
}
