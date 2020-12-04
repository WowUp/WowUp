import { HttpClient } from "@angular/common/http";
import { Observable, of } from "rxjs";
import { v4 as uuidv4 } from "uuid";
import { ADDON_PROVIDER_HUB, WOWUP_GET_SCAN_RESULTS } from "../../common/constants";
import { WowUpScanResult } from "../../common/wowup/wowup-scan-result";
import { AppConfig } from "../../environments/environment";
import { Addon } from "../entities/addon";
import { WowClientType } from "../models/warcraft/wow-client-type";
import { GetAddonsByFingerprintResponse } from "../models/wowup-api/get-addons-by-fingerprint.response";
import { WowGameType } from "../models/wowup-api/wow-game-type";
import { WowUpAddonReleaseRepresentation, WowUpAddonRepresentation } from "../models/wowup-api/addon-representations";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonFolder } from "../models/wowup/addon-folder";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { AppWowUpScanResult } from "../models/wowup/app-wowup-scan-result";
import { WowUpGetAddonsResponse } from "../models/wowup-api/api-responses";
import { ElectronService } from "../services";
import { AddonProvider } from "./addon-provider";
import { getEnumName } from "../utils/enum.utils";
import { first, map } from "lodash";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";
import { getGameVersion } from "../utils/addon.utils";

const API_URL = AppConfig.wowUpHubUrl;

export class WowUpAddonProvider implements AddonProvider {
  public readonly name = ADDON_PROVIDER_HUB;
  public readonly forceIgnore = false;
  public readonly allowReinstall = true;
  public readonly allowChannelChange = false;
  public enabled = true;

  constructor(private _httpClient: HttpClient, private _electronService: ElectronService) {}

  async getAll(clientType: WowClientType, addonIds: string[]): Promise<AddonSearchResult[]> {
    const url = new URL(`${API_URL}/addons`);
    const addons = await this._httpClient.get<WowUpAddonRepresentation[]>(url.toString()).toPromise();

    // TODO
    return [];
  }

  public async getFeaturedAddons(clientType: WowClientType): Promise<AddonSearchResult[]> {
    const gameType = this.getWowGameType(clientType);
    const url = new URL(`${API_URL}/addons/featured/${gameType}`);
    const addons = await this._httpClient.get<WowUpGetAddonsResponse>(url.toString()).toPromise();
    console.log("WOWUP FEAT", addons);
    const searchResults = map(addons?.addons, (addon) => this.getSearchResult(addon));
    return searchResults;
  }

  async searchByQuery(query: string, clientType: WowClientType): Promise<AddonSearchResult[]> {
    // TODO
    return [];
  }

  async searchByUrl(addonUri: URL, clientType: WowClientType): Promise<AddonSearchResult> {
    // TODO
    return undefined;
  }

  async searchByName(
    addonName: string,
    folderName: string,
    clientType: WowClientType,
    nameOverride?: string
  ): Promise<AddonSearchResult[]> {
    // TODO
    return [];
  }

  getById(addonId: string, clientType: WowClientType): Observable<AddonSearchResult> {
    // TODO
    return of(undefined);
  }

  isValidAddonUri(addonUri: URL): boolean {
    // TODO
    return false;
  }

  isValidAddonId(addonId: string): boolean {
    return true;
  }

  onPostInstall(addon: Addon): void {
    throw new Error("Method not implemented.");
  }

  async scan(clientType: WowClientType, addonChannelType: any, addonFolders: AddonFolder[]): Promise<void> {
    // const url = `${API_URL}/addons`;
    // const addons = await this._httpClient
    //   .get<WuAddon[]>(url.toString())
    //   .toPromise();

    const scanResults = await this.getScanResults(addonFolders);

    console.debug("ScanResults", scanResults.length);

    const fingerprintResponse = await this.getAddonsByFingerprints(
      scanResults.map((result) => result.fingerprint)
    ).toPromise();

    console.log("fingerprintResponse", fingerprintResponse);

    for (let scanResult of scanResults) {
      // Curse can deliver the wrong result sometimes, ensure the result matches the client type
      scanResult.exactMatch = fingerprintResponse.exactMatches.find(
        (exactMatch) =>
          this.isGameType(exactMatch.matched_release, clientType) &&
          this.hasMatchingFingerprint(scanResult, exactMatch.matched_release)
      );

      // If the addon does not have an exact match, check the partial matches.
      // if (!scanResult.exactMatch) {
      //   scanResult.exactMatch = fingerprintResponse.partialMatches.find(
      //     (partialMatch) =>
      //       partialMatch.file?.modules?.some(
      //         (module) => module.fingerprint === scanResult.fingerprint
      //       )
      //   );
      // }
    }

    const matchedScanResults = scanResults.filter((sr) => !!sr.exactMatch);
    const matchedScanResultIds = matchedScanResults.map((sr) => sr.exactMatch.id);

    for (let addonFolder of addonFolders) {
      var scanResult = scanResults.find((sr) => sr.path === addonFolder.path);
      if (!scanResult.exactMatch) {
        console.log("No search result match", scanResult.path);
        continue;
      }

      try {
        const newAddon = this.getAddon(clientType, addonChannelType, scanResult);

        addonFolder.matchingAddon = newAddon;
      } catch (err) {
        console.error(scanResult);
        console.error(err);
        // TODO
        // _analyticsService.Track(ex, $"Failed to create addon for result {scanResult.FolderScanner.Fingerprint}");
      }
    }
  }

  private hasMatchingFingerprint(scanResult: WowUpScanResult, release: WowUpAddonReleaseRepresentation) {
    return release.addonFolders.some((addonFolder) => addonFolder.fingerprint == scanResult.fingerprint);
  }

  private isGameType(release: WowUpAddonReleaseRepresentation, clientType: WowClientType) {
    return release.game_type === this.getWowGameType(clientType);
  }

  private getAddonsByFingerprints(fingerprints: string[]): Observable<GetAddonsByFingerprintResponse> {
    const url = `${API_URL}/addons/fingerprint`;

    return this._httpClient.post<any>(url, {
      fingerprints,
    });
  }

  private getScanResults = async (addonFolders: AddonFolder[]): Promise<AppWowUpScanResult[]> => {
    const t1 = Date.now();

    const filePaths = addonFolders.map((addonFolder) => addonFolder.path);

    const scanResults: AppWowUpScanResult[] = await this._electronService.ipcRenderer.invoke(
      WOWUP_GET_SCAN_RESULTS,
      filePaths
    );

    console.log("scan delta", Date.now() - t1);
    console.log("WowUpGetScanResultsResponse", scanResults);

    return scanResults;
  };

  private getSearchResult(representation: WowUpAddonRepresentation): AddonSearchResult {
    const release = first(representation.releases);
    const searchResultFiles: AddonSearchResultFile[] = [];
    if (release) {
      searchResultFiles.push({
        channelType: AddonChannelType.Stable,
        downloadUrl: release.download_url,
        folders: [],
        gameVersion: getGameVersion(release.game_version),
        releaseDate: release.published_at,
        version: release.name,
        dependencies: [],
      });
    }

    return {
      author: representation.owner_name,
      externalId: representation.id.toString(),
      externalUrl: representation.repository,
      name: representation.repository_name,
      providerName: this.name,
      thumbnailUrl: representation.owner_image_url,
      downloadCount: representation.total_download_count,
      files: searchResultFiles,
      releasedAt: new Date(),
      screenshotUrl: "",
      screenshotUrls: [],
      summary: representation.description,
    };
  }

  private getAddon(
    clientType: WowClientType,
    addonChannelType: AddonChannelType,
    scanResult: AppWowUpScanResult
  ): Addon {
    const primaryAddonFolder = scanResult.exactMatch.matched_release.addonFolders.find(
      (af) => af.load_on_demand === false
    );
    const authors = scanResult.exactMatch.owner_name;
    const folderList = scanResult.exactMatch.matched_release.addonFolders.map((af) => af.folder_name).join(", ");

    let channelType = addonChannelType;
    let latestVersion = primaryAddonFolder.version;

    return {
      id: uuidv4(),
      author: authors,
      name: scanResult.exactMatch.repository_name,
      channelType,
      autoUpdateEnabled: false,
      clientType,
      downloadUrl: scanResult.exactMatch.matched_release.download_url,
      externalUrl: scanResult.exactMatch.repository,
      externalId: scanResult.exactMatch.id.toString(),
      gameVersion: scanResult.exactMatch.matched_release.game_version,
      installedAt: new Date(),
      installedFolders: folderList,
      installedVersion: scanResult.exactMatch.matched_release.tagName,
      isIgnored: false,
      latestVersion: scanResult.exactMatch.matched_release.tagName,
      providerName: this.name,
      providerSource: scanResult.exactMatch.source,
      thumbnailUrl: scanResult.exactMatch.image_url,
      fundingLinks: [...scanResult.exactMatch.funding_links],
      isLoadOnDemand: false,
      releasedAt: scanResult.exactMatch?.matched_release?.published_at,
      externalChannel: getEnumName(AddonChannelType, AddonChannelType.Stable),
    };
  }

  private getWowGameType(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Classic:
      case WowClientType.ClassicPtr:
        return WowGameType.Classic;
      case WowClientType.Retail:
      case WowClientType.RetailPtr:
      case WowClientType.Beta:
      default:
        return WowGameType.Retail;
    }
  }
}
