import _ from "lodash";
import { BehaviorSubject, from, Observable } from "rxjs";
import { filter, first, map, tap, timeout } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";

import { ADDON_PROVIDER_WAGO } from "../../common/constants";
import { Addon } from "../../common/entities/addon";
import { WowClientGroup, WowClientType } from "../../common/warcraft/wow-client-type";
import { WowInstallation } from "../../common/warcraft/wow-installation";
import { AddonChannelType, AdPageOptions } from "../../common/wowup/models";
import { AppConfig } from "../../environments/environment";
import { AddonFolder } from "../models/wowup/addon-folder";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";
import { AppWowUpScanResult } from "../models/wowup/app-wowup-scan-result";
import { ElectronService } from "../services";
import { CachingService } from "../services/caching/caching-service";
import { CircuitBreakerWrapper, NetworkService } from "../services/network/network.service";
import { TocService } from "../services/toc/toc.service";
import { WarcraftService } from "../services/warcraft/warcraft.service";
import { getGameVersion } from "../utils/addon.utils";
import { getEnumName } from "../utils/enum.utils";
import { convertMarkdown } from "../utils/markdown.utlils";
import { AddonProvider, GetAllResult } from "./addon-provider";

declare type WagoGameVersion = "retail" | "classic" | "bcc";
declare type WagoStability = "stable" | "beta" | "alpha";

interface WagoFingerprintAddon {
  name: string; // the folder name
  hash: string; // hash fingerprint of the folder
  cf?: string; // curseforge toc id
  wowi?: string; // wow interface toc id
  wago?: string; // wago interface toc id
}

interface WagoFingerprintRequest {
  game_version: WagoGameVersion;
  addons: WagoFingerprintAddon[];
}

interface WagoSearchResponse {
  data: WagoSearchResponseItem[];
}

interface WagoSearchResponseItem {
  display_name: string;
  id: string;
  releases: {
    alpha?: WagoSearchResponseRelease;
    beta?: WagoSearchResponseRelease;
    stable?: WagoSearchResponseRelease;
  };
  summary: string;
  thumbnail_image: string;
  authors: string[];
  download_count: number;
  website_url: string;
}

interface WagoSearchResponseRelease {
  download_link: string;
  label: string;
  created_at: string;
  logical_timestamp: number; // download link expiration time
}

interface WagoAddon {
  id: string;
  slug: string;
  display_name: string;
  thumbnail_image: string;
  summary: string;
  description: string;
  website: string;
  gallery: string[];
  recent_releases: {
    stable?: WagoRelease;
    beta?: WagoRelease;
    alpha?: WagoRelease;
  };
}

interface WagoRelease {
  label: string;
  supported_retail_patch: string;
  supported_classic_patch: string;
  supported_bc_patch: string;
  changelog: string;
  stability: WagoStability;
  download_link: string;
}

interface WagoScanRelease {
  id: string;
  created_at: string;
  label: string;
  patch: string;
  link?: string;
}

interface WagoScanModule {
  hash?: string;
}

interface WagoScanAddon {
  id: string;
  name: string;
  thumbnail: string;
  website_url: string;
  authors?: string[];
  cf?: string;
  wago?: string;
  wowi?: string;
  matched_release?: WagoScanRelease;
  modules?: { [folder: string]: WagoScanModule };
  recent_releases: {
    stable?: WagoScanRelease;
    beta?: WagoScanRelease;
    alpha?: WagoScanRelease;
  };
}

interface WagoScanResponse {
  addons: WagoScanAddon[];
}

const WAGO_BASE_URL = "https://addons.wago.io/api/external";
const WAGO_AD_URL = "https://addons.wago.io/wowup_ad";
const WAGO_AD_REFERRER = "https://wago.io";
const WAGO_AD_USER_AGENT =
  "`Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36`"; // the ad requires a normal looking user agent
const WAGO_AD_PRELOAD = "preload/wago.js";
const WAGO_SEARCH_CACHE_TIME_SEC = 20;
const WAGO_DETAILS_CACHE_TIME_SEC = 20;

export class WagoAddonProvider extends AddonProvider {
  private readonly _circuitBreaker: CircuitBreakerWrapper;

  private _apiTokenSrc = new BehaviorSubject<string>("");
  private _enabled = true;

  public readonly name = ADDON_PROVIDER_WAGO;
  public readonly forceIgnore = false;
  public enabled = true;
  public authRequired = true;
  public adRequired = true;
  public allowEdit = true;

  public constructor(
    private _electronService: ElectronService,
    private _cachingService: CachingService,
    private _networkService: NetworkService,
    private _warcraftService: WarcraftService,
    private _tocService: TocService
  ) {
    super();

    this._circuitBreaker = _networkService.getCircuitBreaker(
      `${this.name}_main`,
      AppConfig.defaultHttpResetTimeoutMs,
      AppConfig.wagoHttpTimeoutMs
    );

    this._electronService.on("wago-token-received", this.onWagoTokenReceived);
  }

  public async scan(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {
    const gameVersion = this.getGameVersion(installation.clientType);

    console.time("WagoScan");
    const scanResults = await this.getScanResults(addonFolders);
    console.timeEnd("WagoScan");

    const request: WagoFingerprintRequest = {
      game_version: gameVersion,
      addons: [],
    };

    scanResults.forEach((res) => {
      const addonFolder = addonFolders.find((af) => af.name === res.folderName);
      const toc = this._tocService.getTocForGameType2(addonFolder, installation.clientType);

      const waddon: WagoFingerprintAddon = {
        name: res.folderName,
        hash: res.fingerprint,
      };

      if (toc.wagoAddonId) {
        waddon.wago = toc.wagoAddonId;
      }

      request.addons.push(waddon);
    });

    console.debug(`[wago] scan`, request);
    console.debug(JSON.stringify(request, null, 2));

    const matchResult = await this.sendMatchesRequest(request);
    console.debug(`[wago] matchResult`, matchResult);

    const scanResultMap = {};

    for (const scanResult of scanResults) {
      const fingerprintMatches = matchResult.addons.filter((addon) => {
        const mods = Object.values(addon.modules).filter((mod) => typeof mod.hash === "string");
        return mods.findIndex((mod) => mod.hash === scanResult.fingerprint) !== -1;
      });

      if (fingerprintMatches.length > 0) {
        if (fingerprintMatches.length > 1) {
          console.warn(`[wago] found multiple fingerprintMatches: ${scanResult.folderName}`);
        }

        scanResultMap[scanResult.folderName] = fingerprintMatches[0];
      }
      console.debug(`[wago] fingerprintMatches`, fingerprintMatches);
    }

    for (const addonFolder of addonFolders) {
      const scanResult = scanResults.find((sr) => sr.folderName === addonFolder.name);
      if (scanResult === undefined || !scanResultMap[scanResult.folderName]) {
        continue;
      }

      try {
        const match = scanResultMap[scanResult.folderName];
        const newAddon = this.toAddon(installation, addonChannelType, match);

        // addonFolder.matchingAddon = newAddon;
      } catch (e) {
        console.error(`[wago] scan result`, scanResult);
        console.error(`[wago] scan error`, e);
      }
    }

    console.debug(`[wago] delta`, addonFolders)
  }

  public async searchByQuery(
    query: string,
    installation: WowInstallation,
    channelType?: AddonChannelType
  ): Promise<AddonSearchResult[]> {
    try {
      await this.ensureToken().toPromise();
    } catch (e) {
      console.error("[wago]", e);
      return [];
    }

    const url = new URL(`${WAGO_BASE_URL}/addons/_search`);
    url.searchParams.set("query", query);
    url.searchParams.set("game_version", this.getGameVersion(installation.clientType));
    url.searchParams.set("stability", this.getStability(channelType));

    const response = await this._cachingService.transaction(
      url.toString(),
      () => this._circuitBreaker.getJson<WagoSearchResponse>(url, this.getRequestHeaders()),
      WAGO_SEARCH_CACHE_TIME_SEC
    );

    const searchResults = response.data?.map((item) => this.toSearchResult(item)) ?? [];

    console.debug(`[wago] searchByQuery`, response, searchResults);

    return searchResults;
  }

  public async getDescription(installation: WowInstallation, externalId: string, addon?: Addon): Promise<string> {
    await this.ensureToken().toPromise();

    try {
      const response = await this.getAddonById(externalId);
      return convertMarkdown(response?.description ?? "");
    } catch (e) {
      console.error(`[wago] failed to get description`, e);
      return "";
    }
  }

  public async getChangelog(
    installation: WowInstallation,
    externalId: string,
    externalReleaseId: string
  ): Promise<string> {
    console.debug("[wago] getChangelog");
    try {
      const response = await this.getAddonById(externalId);
      console.debug("[wago] getChangelog", response);

      const releases = Object.values(response.recent_releases);
      // _.sortBy(releases, rel => rel.)

      return convertMarkdown(response?.description ?? "");
    } catch (e) {
      console.error("[wago] Failed to get changelog", e);
      return "";
    }
  }

  public getAdPageParams(): AdPageOptions {
    return {
      pageUrl: WAGO_AD_URL,
      referrer: WAGO_AD_REFERRER,
      userAgent: WAGO_AD_USER_AGENT,
      preloadFilePath: WAGO_AD_PRELOAD,
    };
  }

  // used when checking for new addon updates
  public async getAll(installation: WowInstallation, addonIds: string[]): Promise<GetAllResult> {
    await this.ensureToken().toPromise();

    console.debug(`[wago] getAll`);

    return Promise.resolve({
      errors: [],
      searchResults: [],
    });
  }

  private async getAddonById(addonId: string) {
    const url = new URL(`${WAGO_BASE_URL}/addons/${addonId}`);
    return await this._cachingService.transaction(
      url.toString(),
      () => this._circuitBreaker.getJson<WagoAddon>(url, this.getRequestHeaders()),
      WAGO_DETAILS_CACHE_TIME_SEC
    );
  }

  private async sendMatchesRequest(request: WagoFingerprintRequest) {
    const url = new URL(`${WAGO_BASE_URL}/addons/_match`);
    return await this._cachingService.transaction(
      url.toString(),
      () => this._circuitBreaker.postJson<WagoScanResponse>(url, request, this.getRequestHeaders()),
      WAGO_DETAILS_CACHE_TIME_SEC
    );
  }

  private toSearchResult(item: WagoSearchResponseItem): AddonSearchResult {
    const releaseTypes = Object.keys(item.releases);
    const searchResultFiles: AddonSearchResultFile[] = [];
    for (const type of releaseTypes) {
      searchResultFiles.push(this.toSearchResultFile(item.releases[type], type as WagoStability));
    }

    return {
      author: item.authors.join(", "),
      externalId: item.id,
      externalUrl: item.website_url,
      name: item.display_name,
      providerName: this.name,
      thumbnailUrl: item.thumbnail_image,
      downloadCount: item.download_count,
      files: searchResultFiles,
      releasedAt: new Date(),
      summary: item.summary,
    };
  }

  private toSearchResultFile(release: WagoSearchResponseRelease, stability: WagoStability): AddonSearchResultFile {
    return {
      channelType: this.getAddonChannelType(stability),
      downloadUrl: release.download_link,
      folders: [],
      gameVersion: "",
      releaseDate: new Date(release.created_at),
      version: release.label,
      dependencies: [],
    };
  }

  private toAddon(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    wagoScanAddon: WagoScanAddon
  ): Addon {
    const authors = wagoScanAddon?.authors?.join(", ") ?? "";
    const name = wagoScanAddon?.name ?? "";
    const downloadUrl = wagoScanAddon?.matched_release?.link ?? "";
    const externalUrl = wagoScanAddon?.website_url ?? "";
    const externalId = wagoScanAddon?.id ?? "";
    const gameVersion = getGameVersion(wagoScanAddon?.matched_release?.patch);
    const thumbnailUrl = wagoScanAddon?.thumbnail ?? "";
    const releasedAt = wagoScanAddon?.matched_release?.created_at
      ? new Date(wagoScanAddon?.matched_release?.created_at)
      : undefined;

    const installedVersion = wagoScanAddon?.matched_release?.label ?? "";
    const installedExternalReleaseId = wagoScanAddon?.matched_release?.id ?? "";
    const installedFolders: string[] = [];

    for (let [key, val] of Object.entries(wagoScanAddon.modules)) {
      if (typeof val.hash !== "string") {
        continue;
      }

      installedFolders.push(key);
    }

    const latestVersion = wagoScanAddon?.recent_releases?.stable?.label ?? "";
    const externalLatestReleaseId = wagoScanAddon?.recent_releases?.stable?.id ?? undefined;
    const externalChannel = getEnumName(AddonChannelType, addonChannelType);

    return {
      id: uuidv4(),
      author: authors,
      name,
      channelType: addonChannelType,
      autoUpdateEnabled: false,
      autoUpdateNotificationsEnabled: false,
      clientType: installation.clientType,
      downloadUrl,
      externalUrl,
      externalId,
      gameVersion,
      installedAt: new Date(),
      installedFolders: installedFolders.join(","),
      installedFolderList: installedFolders,
      installedVersion,
      installedExternalReleaseId,
      isIgnored: false,
      latestVersion,
      providerName: this.name,
      thumbnailUrl,
      isLoadOnDemand: false,
      releasedAt,
      externalChannel,
      externalLatestReleaseId,
      installationId: installation.id,
    };
  }

  private getAddonChannelType(stability: WagoStability): AddonChannelType {
    switch (stability) {
      case "alpha":
        return AddonChannelType.Alpha;
      case "beta":
        return AddonChannelType.Beta;
      case "stable":
      default:
        return AddonChannelType.Stable;
    }
  }

  // Get the wago friendly name for our addon channel
  private getStability(channelType: AddonChannelType): WagoStability {
    switch (channelType) {
      case AddonChannelType.Alpha:
        return "alpha";
      case AddonChannelType.Beta:
        return "beta";
      case AddonChannelType.Stable:
      default:
        return "stable";
    }
  }

  // The wago name for the client type
  private getGameVersion(clientType: WowClientType): WagoGameVersion {
    const clientGroup = this._warcraftService.getClientGroup(clientType);
    switch (clientGroup) {
      case WowClientGroup.BurningCrusade:
        return "bcc";
      case WowClientGroup.Classic:
        return "classic";
      case WowClientGroup.Retail:
        return "retail";
      default:
        throw new Error(`[wago] Un-handled client type: ${clientType}`);
    }
  }

  // Scan the actual folders, luckily wago uses the same fingerprint method as wowup
  private getScanResults = async (addonFolders: AddonFolder[]): Promise<AppWowUpScanResult[]> => {
    const filePaths = addonFolders.map((addonFolder) => addonFolder.path);
    const scanResults: AppWowUpScanResult[] = await this._electronService.invoke("wowup-get-scan-results", filePaths);
    return scanResults;
  };

  private onWagoTokenReceived = (evt, token) => {
    console.log(`[wago] onWagoTokenReceived`, token);
    this._apiTokenSrc.next(token);
  };

  private getRequestHeaders(): {
    [header: string]: string | string[];
  } {
    return {
      Authorization: `Bearer ${this._apiTokenSrc.value}`,
    };
  }

  private ensureToken(timeoutMs = 30000): Observable<string> {
    return this._apiTokenSrc.pipe(
      timeout(timeoutMs),
      first((token) => token !== ""),
      tap((token) => console.log(`[wago] ensureToken`))
    );
  }
}