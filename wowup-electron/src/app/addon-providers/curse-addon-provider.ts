import { AddonProvider } from "./addon-provider";
import { WowClientType } from "../models/warcraft/wow-client-type";
import { Addon } from "../entities/addon";
import { HttpClient } from "@angular/common/http";
import { map } from "rxjs/operators";
import * as _ from "lodash";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { from, Observable, of } from "rxjs";
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
import { CurseSearchResult } from "../../common/curse/curse-search-result";
import { CurseFile } from "common/curse/curse-file";
import { CurseReleaseType } from "common/curse/curse-release-type";
import { CurseGetFeaturedResponse } from "app/models/curse/curse-get-featured-response";
import * as CircuitBreaker from "opossum";

const API_URL = "https://addons-ecs.forgesvc.net/api/v2";
const HUB_API_URL = "https://hub.dev.wowup.io";

export class CurseAddonProvider implements AddonProvider {
  private readonly _circuitBreaker: CircuitBreaker<
    [clientType: () => Promise<any>],
    any
  >;

  private getCircuitBreaker<T>() {
    return this._circuitBreaker as CircuitBreaker<
      [clientType: () => Promise<T>],
      T
    >;
  }

  public readonly name = "Curse";

  constructor(
    private _httpClient: HttpClient,
    private _cachingService: CachingService,
    private _electronService: ElectronService
  ) {
    this._circuitBreaker = new CircuitBreaker(
      (action) => this.sendRequest(action),
      {
        resetTimeout: 60000,
      }
    );

    this._circuitBreaker.on("open", () => {
      console.log(`${this.name} circuit breaker open`);
    });
    this._circuitBreaker.on("close", () => {
      console.log(`${this.name} circuit breaker close`);
    });
  }

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

    const matchedScanResults = scanResults.filter((sr) => !!sr.exactMatch);
    const matchedScanResultIds = matchedScanResults.map(
      (sr) => sr.exactMatch.id
    );
    const addonIds = _.uniq(matchedScanResultIds);

    var addonResults = await this.getAllIds(addonIds);

    for (let addonFolder of addonFolders) {
      var scanResult = scanResults.find(
        (sr) => sr.addonFolder.name === addonFolder.name
      );
      if (!scanResult.exactMatch) {
        console.log("No search result match", scanResult.directory);
        continue;
      }

      scanResult.searchResult = addonResults.find(
        (addonResult) => addonResult.id === scanResult.exactMatch.id
      );
      if (!scanResult.searchResult) {
        console.log("No search result match", scanResult.directory);
        continue;
      }

      try {
        const newAddon = this.getAddon(clientType, scanResult);

        addonFolder.matchingAddon = newAddon;
      } catch (err) {
        console.error(scanResult);
        console.error(err);
        // TODO
        // _analyticsService.Track(ex, $"Failed to create addon for result {scanResult.FolderScanner.Fingerprint}");
      }
    }
  }

  private async mapAddonFolders(
    scanResults: AppCurseScanResult[],
    clientType: WowClientType
  ) {
    if (clientType === WowClientType.None) {
      return;
    }

    scanResults.forEach((result) => {
      console.debug(result.folderName, result.fingerprint);
    });

    const fingerprintResponse = await this.getAddonsByFingerprintsW(
      scanResults.map((result) => result.fingerprint)
    );

    console.log("fingerprintResponse", fingerprintResponse);

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
      if (!scanResult.exactMatch && fingerprintResponse.partialMatches) {
        scanResult.exactMatch = fingerprintResponse.partialMatches.find(
          (partialMatch) =>
            partialMatch.file?.modules?.some(
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

  private async getAddonsByFingerprintsW(fingerprints: number[]) {
    const url = `${HUB_API_URL}/curseforge/addons/fingerprint`;

    console.log(`Wowup Fetching fingerprints`, JSON.stringify(fingerprints));

    return await this._httpClient
      .post<CurseFingerprintsResponse>(url, {
        fingerprints,
      })
      .toPromise();

    return await this.getCircuitBreaker<CurseFingerprintsResponse>().fire(
      async () =>
        await this._httpClient
          .post<CurseFingerprintsResponse>(url, fingerprints)
          .toPromise()
    );
  }

  private async getAddonsByFingerprints(
    fingerprints: number[]
  ): Promise<CurseFingerprintsResponse> {
    const url = `${API_URL}/fingerprint`;

    console.log(`Curse Fetching fingerprints`, JSON.stringify(fingerprints));

    return await this.getCircuitBreaker<CurseFingerprintsResponse>().fire(
      async () =>
        await this._httpClient
          .post<CurseFingerprintsResponse>(url, fingerprints)
          .toPromise()
    );
  }

  private async getAllIds(addonIds: number[]): Promise<CurseSearchResult[]> {
    if (!addonIds?.length) {
      return [];
    }

    const url = `${API_URL}/addon`;

    return await this.getCircuitBreaker<CurseSearchResult[]>().fire(
      async () =>
        await this._httpClient
          .post<CurseSearchResult[]>(url, addonIds)
          .toPromise()
    );
  }

  private sendRequest<T>(action: () => Promise<T>): Promise<T> {
    return action.call(this);
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
    );

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

  getFeaturedAddons(clientType: WowClientType, channelType?: AddonChannelType): Observable<PotentialAddon[]> {
    channelType = typeof channelType === 'undefined' ? AddonChannelType.Stable : channelType;
    return from(this.getFeaturedAddonList()).pipe(
      map((addons) => {
        return this.filterFeaturedAddons(addons, clientType);
      }),
      map((filteredAddons) => {
        return filteredAddons.map((addon) => this.getPotentialAddon(addon, clientType, channelType));
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
    clientType: WowClientType,
    channelType?: AddonChannelType
  ): Promise<PotentialAddon[]> {
    channelType = typeof channelType === 'undefined' ? AddonChannelType.Stable : channelType;
    var searchResults: PotentialAddon[] = [];

    var response = await this.getSearchResults(query);
    for (let result of response) {
      var latestFiles = this.getLatestFiles(result, clientType);
      if (!latestFiles.length) {
        continue;
      }

      searchResults.push(this.getPotentialAddon(result, clientType, channelType));
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

  private async getSearchResults(query: string): Promise<CurseSearchResult[]> {
    const url = new URL(`${API_URL}/addon/search`);
    url.searchParams.set("gameId", "1");
    url.searchParams.set("searchFilter", query);

    return await this.getCircuitBreaker<CurseSearchResult[]>().fire(
      async () =>
        await this._httpClient
          .get<CurseSearchResult[]>(url.toString())
          .toPromise()
    );
  }

  getById(
    addonId: string,
    clientType: WowClientType
  ): Observable<AddonSearchResult> {
    const url = `${API_URL}/addon/${addonId}`;

    return from(
      this.getCircuitBreaker<CurseSearchResult>().fire(
        async () =>
          await this._httpClient.get<CurseSearchResult>(url).toPromise()
      )
    ).pipe(
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

  private getPotentialAddon(result: CurseSearchResult, clientType: WowClientType, channelType: AddonChannelType): PotentialAddon {
    const clientTypeStr = this.getGameVersionFlavor(clientType);
    let latestFile = _.orderBy(result.latestFiles, 'id', 'desc')
      .find(file =>
        file.gameVersionFlavor === clientTypeStr &&
        this.getChannelType(file.releaseType) === channelType
      );
    if (!latestFile) {
      latestFile = _.first(result.latestFiles);
    }

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
      version: latestFile.displayName
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

  private async getFeaturedAddonList(): Promise<CurseSearchResult[]> {
    const url = `${API_URL}/addon/featured`;
    const cachedResponse = this._cachingService.get<CurseGetFeaturedResponse>(
      url
    );
    if (cachedResponse) {
      return cachedResponse.Popular;
    }

    const body = {
      gameId: 1,
      featuredCount: 6,
      popularCount: 50,
      updatedCount: 0,
    };

    const result = await this.getCircuitBreaker<
      CurseGetFeaturedResponse
    >().fire(
      async () =>
        await this._httpClient
          .post<CurseGetFeaturedResponse>(url, body)
          .toPromise()
    );

    if (!result) {
      return [];
    }

    this._cachingService.set(url, result);

    return result.Popular;
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

  private getWowUpChannel(releaseType: CurseReleaseType): AddonChannelType {
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

  private getAddon(
    clientType: WowClientType,
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

    let channelType = this.getChannelType(
      scanResult.exactMatch.file.releaseType
    );
    let latestVersion = latestFiles.find(
      (lf) => this.getChannelType(lf.releaseType) <= channelType
    );

    console.log(scanResult.searchResult.name, channelType);

    // If there were no releases that met the channel type restrictions
    if (!latestVersion) {
      latestVersion = _.first(latestFiles);
      channelType = this.getWowUpChannel(latestVersion.releaseType);
      console.warn("falling back to default channel");
    }

    return {
      id: uuidv4(),
      author: authors,
      name: scanResult.searchResult.name,
      channelType,
      autoUpdateEnabled: false,
      clientType,
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
    };
  }
}
