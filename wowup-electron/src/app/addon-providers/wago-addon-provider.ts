import { BehaviorSubject, firstValueFrom, from, Observable, of } from "rxjs";
import { catchError, filter, first, tap, timeout } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";
import _ from "lodash";

import { ADDON_PROVIDER_WAGO, IPC_POWER_MONITOR_RESUME, PREF_WAGO_ACCESS_KEY } from "../../common/constants";
import { AppConfig } from "../../environments/environment";
import { ElectronService } from "../services";
import { CachingService } from "../services/caching/caching-service";
import { CircuitBreakerWrapper, NetworkService } from "../services/network/network.service";
import { TocService } from "../services/toc/toc.service";
import { WarcraftService } from "../services/warcraft/warcraft.service";
import { getEnumName, getWowClientGroupForType } from "wowup-lib-core";
import { convertMarkdown } from "wowup-lib-core";
import { HttpErrorResponse } from "@angular/common/http";
import { UiMessageService } from "../services/ui-message/ui-message.service";
import { SensitiveStorageService } from "../services/storage/sensitive-storage.service";
import {
  Addon,
  AddonChannelType,
  AddonFolder,
  AddonProvider,
  AddonScanResult,
  AddonSearchResult,
  AddonSearchResultFile,
  AdPageOptions,
  DownloadAuth,
  GetAllResult,
  WowClientGroup,
  WowClientType,
} from "wowup-lib-core";
import { WowInstallation } from "wowup-lib-core";
import { SourceRemovedAddonError } from "wowup-lib-core";

declare type WagoGameVersion = "retail" | "classic" | "bc" | "wotlk" | "cata" | "mop";
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
  releases: WagoReleasesResponse<WagoSearchResponseRelease>;
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

interface WagoReleasesResponse<T = WagoRelease> {
  [key: string]: T | undefined;
  alpha?: T;
  beta?: T;
  stable?: T;
}

interface WagoAddon {
  authors: string[];
  description: string;
  display_name: string;
  download_count: number;
  gallery: string[];
  id: string;
  recent_release?: WagoReleasesResponse; // probably a typo on the wago side, shows up in details route
  recent_releases: WagoReleasesResponse;
  slug: string;
  summary: string;
  thumbnail_image: string;
  website: string;
  website_url: string;
}

interface WagoRelease {
  label: string;
  supported_retail_patch: string;
  supported_classic_patch: string;
  supported_bc_patch: string;
  changelog: string;
  stability: WagoStability;
  download_link: string;
  created_at: string;
}

interface WagoScanRelease {
  id: string;
  created_at: string;
  label: string;
  patch: string;
  supported_patches: string[];
  link?: string;
}

interface WagoScanReleaseSortable extends WagoScanRelease {
  stability: string;
  addonChannelType: AddonChannelType;
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

interface WagoPopularAddonsResponse {
  data: WagoSearchResponseItem[];
}

interface WagoRecentsRequest {
  game_version: WagoGameVersion;
  addons: string[];
}

interface WagoRecentsResponse {
  addons: { [addonId: string]: WagoScanAddon };
}

const WAGO_BASE_URL = "https://addons.wago.io/api/external";
const WAGO_AD_URL = "https://addons.wago.io/wowup_ad";
const WAGO_AD_REFERRER = "https://wago.io";
const WAGO_AD_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36"; // the ad requires a normal looking user agent
const WAGO_AD_PRELOAD = "preload/wago.js";
const WAGO_SEARCH_CACHE_TIME_SEC = 60;
const WAGO_DETAILS_CACHE_TIME_SEC = 60;
const WAGO_FEATURED_ADDONS_CACHE_TIME_SEC = 60;

export class WagoAddonProvider extends AddonProvider {
  private readonly _circuitBreaker: CircuitBreakerWrapper;

  private _apiTokenSrc = new BehaviorSubject<string>("");
  private _wagoSecret = "";

  // This is our internal http queue, prevents duplicated requests for some routes
  private _requestQueue: Map<string, Promise<any>> = new Map();

  public readonly name = ADDON_PROVIDER_WAGO;
  public readonly forceIgnore = false;
  public enabled = true;
  public authRequired = true;
  public adRequired = true;
  public allowEdit = true;
  public allowReinstall = true;
  public allowChannelChange = true;

  public constructor(
    private _electronService: ElectronService,
    private _cachingService: CachingService,
    private _warcraftService: WarcraftService,
    private _tocService: TocService,
    private _uiMessageService: UiMessageService,
    private _sensitiveStorageService: SensitiveStorageService,
    _networkService: NetworkService,
  ) {
    super();

    this._circuitBreaker = _networkService.getCircuitBreaker(
      `${this.name}_main`,
      AppConfig.defaultHttpResetTimeoutMs,
      AppConfig.wagoHttpTimeoutMs,
    );

    this._electronService.on("wago-token-received", this.onWagoTokenReceived);

    // Watch for the change of the wago secret in the store
    this._sensitiveStorageService.change$
      .pipe(filter((change) => change.key == PREF_WAGO_ACCESS_KEY))
      .subscribe((change) => {
        console.log("[wago] wago secret set", change);
        if (this.isValidToken(change.value as string)) {
          this._wagoSecret = change.value;
          this._circuitBreaker.close();
        } else {
          this._wagoSecret = "";
        }
      });

    // Initial load of the wago secret
    from(this._sensitiveStorageService.getAsync(PREF_WAGO_ACCESS_KEY))
      .pipe(
        first(),
        tap((accessKey) => {
          const validToken = this.isValidToken(accessKey);
          this.adRequired = !validToken;
          if (validToken) {
            this._wagoSecret = accessKey;
            console.debug("[wago] secret key set");
          }
        }),
        catchError((e) => {
          console.error("[wago] failed to load secret key", e);
          return of(undefined);
        }),
      )
      .subscribe();

    // clear the token on resume so we wait for a new one
    this._electronService.powerMonitor$.pipe(filter((state) => state === IPC_POWER_MONITOR_RESUME)).subscribe(() => {
      this._apiTokenSrc.next("");
    });
  }

  public isValidAddonId(addonId: string): boolean {
    return typeof addonId === "string" && addonId.length >= 8 && addonId.length <= 10;
  }

  public override async scan(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[],
  ): Promise<void> {
    if (!_.some(addonFolders)) {
      return;
    }

    const gameVersion = this.getGameVersion(installation.clientType);
    const scanResults = addonFolders
      .map((af) => af.wowUpScanResults)
      .filter((sr): sr is AddonScanResult => sr !== undefined);

    const request: WagoFingerprintRequest = {
      game_version: gameVersion,
      addons: [],
    };

    scanResults.forEach((res) => {
      const addonFolder = addonFolders.find((af) => af.name === res.folderName);
      if (addonFolder === undefined) {
        console.warn("[wago]: addon folder not found: " + res.folderName);
        return;
      }

      const toc = this._tocService.getTocForGameType2(addonFolder.name, addonFolder.tocs, installation.clientType);
      if (toc === undefined) {
        console.warn("[wago]: getTocForGameType2 returned undefined, " + addonFolder.name);
        return;
      }

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
    console.debug(JSON.stringify(request));

    const matchResult = await this.sendMatchesRequest(request);
    console.debug(`[wago] matchResult`, matchResult);

    const scanResultMap: { [folder: string]: WagoScanAddon } = {};

    for (const scanResult of scanResults) {
      try {
        const fingerprintMatches = matchResult.addons.filter((addon) => {
          // Sometimes the API can return an array with null elements
          if (typeof addon !== "object" || addon === null) {
            return false;
          }

          const mods = Object.values(addon.modules ?? {}).filter((mod) => typeof mod.hash === "string");
          return mods.findIndex((mod) => mod.hash === scanResult.fingerprint) !== -1;
        });

        if (fingerprintMatches.length > 0) {
          if (fingerprintMatches.length > 1) {
            console.warn(`[wago] found multiple fingerprintMatches: ${scanResult.folderName}`);
          }

          scanResultMap[scanResult.folderName] = fingerprintMatches[0];
        }
        // console.debug(`[wago] fingerprintMatches`, fingerprintMatches);
      } catch (e) {
        console.error(`fingerprint scan failed`, matchResult);
        throw e;
      }
    }

    for (const addonFolder of addonFolders) {
      const scanResult = scanResults.find((sr) => sr.folderName === addonFolder.name);
      if (scanResult === undefined || !scanResultMap[scanResult.folderName]) {
        continue;
      }

      try {
        const match = scanResultMap[scanResult.folderName];
        const newAddon = this.toAddon(installation, addonChannelType, match);

        addonFolder.matchingAddon = newAddon;
      } catch (e) {
        console.error(`[wago] scan result`, scanResult);
        console.error(`[wago] scan error`, e);
      }
    }

    console.debug(`[wago] delta`, addonFolders);
  }

  public async getFeaturedAddons(installation: WowInstallation): Promise<AddonSearchResult[]> {
    const url = new URL(`${WAGO_BASE_URL}/addons/popular`);
    url.searchParams.set("game_version", this.getGameVersion(installation.clientType));

    await firstValueFrom(this.ensureToken());

    const response = await this.sendRequest(() =>
      this._cachingService.transaction(
        `${installation.id}|${url.toString()}`,
        () => this._circuitBreaker.getJson<WagoPopularAddonsResponse>(url, this.getRequestHeaders()),
        WAGO_FEATURED_ADDONS_CACHE_TIME_SEC,
      ),
    );

    console.debug(`[wago] getFeaturedAddons`, response);

    const searchResults = response.data?.map((item) => this.toSearchResult(item)) ?? [];
    return searchResults;
  }

  public async searchByQuery(
    query: string,
    installation: WowInstallation,
    channelType?: AddonChannelType,
  ): Promise<AddonSearchResult[]> {
    try {
      await firstValueFrom(this.ensureToken());
    } catch (e) {
      console.error("[wago]", e);
      return [];
    }

    const url = new URL(`${WAGO_BASE_URL}/addons/_search`);
    url.searchParams.set("query", query);
    url.searchParams.set("game_version", this.getGameVersion(installation.clientType));
    url.searchParams.set("stability", this.getStability(channelType));

    const response = await this.sendRequest(() =>
      this._cachingService.transaction(
        `${installation.id}|${query}|${url.toString()}`,
        () => this._circuitBreaker.getJson<WagoSearchResponse>(url, this.getRequestHeaders()),
        WAGO_SEARCH_CACHE_TIME_SEC,
      ),
    );

    const searchResults = response.data?.map((item) => this.toSearchResult(item)) ?? [];

    console.debug(`[wago] searchByQuery`, response, searchResults);

    return searchResults;
  }

  public override async getById(addonId: string): Promise<AddonSearchResult | undefined> {
    const response = await this.getAddonById(addonId);
    return this.toSearchResultFromDetails(response);
  }

  public async getDescription(installation: WowInstallation, externalId: string): Promise<string> {
    try {
      const response = await this.getAddonById(externalId);
      return convertMarkdown(response?.description ?? "");
    } catch (e) {
      console.error(`[wago] failed to get description`, e);
      return "";
    }
  }

  public async getChangelog(installation: WowInstallation, externalId: string): Promise<string> {
    console.debug("[wago] getChangelog");
    try {
      const response = await this.getAddonById(externalId);
      console.debug("[wago] getChangelog", response);

      let release: WagoRelease | undefined = response.recent_release?.stable;
      switch (installation.defaultAddonChannelType) {
        case AddonChannelType.Alpha:
          release = response.recent_release?.alpha || release;
          break;
        case AddonChannelType.Beta:
          release = response.recent_release?.beta || release;
          break;
        default:
          break;
      }

      // if there is not a matching apparent release, return empty
      return release ? convertMarkdown(release.changelog) : "";
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

  private async sendRequest<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action.call(this, null);
    } catch (err) {
      if (err instanceof HttpErrorResponse) {
        console.error("HttpErr", err);
        this._uiMessageService.sendMessage("ad-frame-reload");
      }
      throw err;
    }
  }

  // used when checking for new addon updates
  public override async getAll(installation: WowInstallation, addonIds: string[]): Promise<GetAllResult> {
    await firstValueFrom(this.ensureToken());

    const url = new URL(`${WAGO_BASE_URL}/addons/_recents`).toString();
    const request: WagoRecentsRequest = {
      game_version: this.getGameVersion(installation.clientType),
      addons: [...addonIds],
    };

    const response = await this.sendRequest(() =>
      this._cachingService.transaction(
        `${installation.id}|${url.toString()}`,
        () => this._circuitBreaker.postJson<WagoRecentsResponse>(url, request, this.getRequestHeaders()),
        WAGO_DETAILS_CACHE_TIME_SEC,
      ),
    );

    const searchResults: AddonSearchResult[] = [];
    for (const [, addon] of Object.entries(response.addons)) {
      searchResults.push(this.toSearchResultFromScan(addon));
    }

    const missingAddonIds = _.filter(
      addonIds,
      (addonId) => _.find(searchResults, (sr) => sr.externalId === addonId) === undefined,
    );

    const deletedErrors = _.map(missingAddonIds, (addonId) => new SourceRemovedAddonError(addonId, undefined));

    return Promise.resolve({
      errors: [...deletedErrors],
      searchResults,
    });
  }

  public getDownloadAuth(): Promise<DownloadAuth | undefined> {
    return Promise.resolve({
      queryParams: {
        token: this.getToken(),
      },
    });
  }

  private getToken(): string {
    return this.isValidToken(this._wagoSecret) ? this._wagoSecret : this._apiTokenSrc.value;
  }

  private async getAddonById(addonId: string): Promise<WagoAddon> {
    const url = new URL(`${WAGO_BASE_URL}/addons/${addonId}`).toString();

    if (this._requestQueue.has(url)) {
      return this._requestQueue.get(url);
    }

    await firstValueFrom(this.ensureToken());

    const prom = this.sendRequest(() =>
      this._cachingService
        .transaction(
          url,
          () => this._circuitBreaker.getJson<WagoAddon>(url, this.getRequestHeaders()),
          WAGO_DETAILS_CACHE_TIME_SEC,
        )
        .finally(() => {
          this._requestQueue.delete(url);
        }),
    );

    this._requestQueue.set(url, prom);

    return await prom;
  }

  private async sendMatchesRequest(request: WagoFingerprintRequest) {
    const url = new URL(`${WAGO_BASE_URL}/addons/_match`);
    await firstValueFrom(this.ensureToken());

    return await this.sendRequest(() =>
      this._circuitBreaker.postJson<WagoScanResponse>(url, request, this.getRequestHeaders()),
    );
  }

  private toSearchResultFromScan(item: WagoScanAddon): AddonSearchResult {
    const releaseObj = item.recent_releases;
    const releaseTypes = Object.keys(releaseObj) as WagoStability[];
    const searchResultFiles: AddonSearchResultFile[] = [];
    for (const type of releaseTypes) {
      const channel = releaseObj[type];
      if (channel !== undefined) {
        searchResultFiles.push(this.toSearchResultFile(channel, type));
      }
    }

    return {
      author: item.authors?.join(", ") ?? "",
      externalId: item.id,
      externalUrl: item.website_url,
      name: item.name,
      providerName: this.name,
      thumbnailUrl: item.thumbnail,
      downloadCount: 0,
      files: searchResultFiles,
      releasedAt: new Date(),
      summary: "",
    };
  }

  private toSearchResultFromDetails(item: WagoAddon): AddonSearchResult {
    const releaseObj = item.recent_releases ?? item.recent_release;
    const releaseTypes = Object.keys(releaseObj) as WagoStability[];
    const searchResultFiles: AddonSearchResultFile[] = [];
    for (const type of releaseTypes) {
      const channel = releaseObj[type];
      if (channel !== undefined) {
        searchResultFiles.push(this.toSearchResultFile(channel, type));
      }
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

  private toSearchResult(item: WagoSearchResponseItem): AddonSearchResult {
    const releaseTypes = Object.keys(item.releases);
    const searchResultFiles: AddonSearchResultFile[] = [];
    for (const type of releaseTypes) {
      const release = item.releases[type];
      if (release !== undefined) {
        searchResultFiles.push(this.toSearchResultFile(release, type as WagoStability));
      }
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

  private toSearchResultFile(
    release: WagoSearchResponseRelease | WagoRelease | WagoScanRelease,
    stability: WagoStability,
  ): AddonSearchResultFile {
    if (release === undefined) {
      throw new Error("toSearchResultFile failed, undefined release");
    }

    return {
      channelType: this.getAddonChannelType(stability),
      downloadUrl: (release as any).download_link || (release as any).link,
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
    wagoScanAddon: WagoScanAddon,
  ): Addon {
    // Grab a ref to the recent release matching the id of the matched release, the objects do not appear to match.
    // const recentRelease = Object.values(wagoScanAddon.recent_releases).find(
    //   (rr) => rr.id === wagoScanAddon.matched_release.id
    // );

    const authors = wagoScanAddon?.authors?.join(", ") ?? "";
    const name = wagoScanAddon?.name ?? "";
    const externalUrl = wagoScanAddon?.website_url ?? "";
    const externalId = wagoScanAddon?.id ?? "";
    const gameVersions = wagoScanAddon?.matched_release?.supported_patches ?? [];
    const thumbnailUrl = wagoScanAddon?.thumbnail ?? "";
    const releasedAt = wagoScanAddon?.matched_release?.created_at
      ? new Date(wagoScanAddon?.matched_release?.created_at)
      : undefined;

    const installedVersion = wagoScanAddon?.matched_release?.label ?? "";
    const installedExternalReleaseId = wagoScanAddon?.matched_release?.id ?? "";
    const installedFolders: string[] = [];

    for (const [key, val] of Object.entries(wagoScanAddon.modules ?? {})) {
      if (typeof val.hash !== "string") {
        continue;
      }

      installedFolders.push(key);
    }

    // Sort the releases by release date, then find the first one that has a valid channel type
    const releaseList: WagoScanReleaseSortable[] = this.getSortedReleaseList(wagoScanAddon);
    const validVersion = releaseList.find((rel) => rel.addonChannelType <= addonChannelType);
    if (validVersion === undefined) {
      throw new Error("toAddon failed valid version not found");
    }

    const latestVersion = validVersion.label;
    const externalLatestReleaseId = validVersion.id;
    const externalChannel = getEnumName(AddonChannelType, validVersion.addonChannelType);
    const downloadUrl = validVersion.link ?? "";

    return {
      id: uuidv4(),
      author: authors,
      name,
      channelType: validVersion.addonChannelType,
      autoUpdateEnabled: false,
      autoUpdateNotificationsEnabled: false,
      clientType: installation.clientType,
      downloadUrl,
      externalUrl,
      externalId,
      gameVersion: gameVersions,
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

  /** Convert a stability map of addons into a sorted list of addons */
  private getSortedReleaseList(wagoScanAddon: WagoScanAddon): WagoScanReleaseSortable[] {
    let releaseList: WagoScanReleaseSortable[] = [];
    for (const [key, value] of Object.entries(wagoScanAddon.recent_releases)) {
      releaseList.push({ ...value, stability: key, addonChannelType: this.getAddonChannelType(key as WagoStability) });
    }

    releaseList = _.sortBy(releaseList, (rel) => new Date(rel.created_at).getTime()).reverse();

    return releaseList;
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
  private getStability(channelType: AddonChannelType | undefined): WagoStability {
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
    const clientGroup = getWowClientGroupForType(clientType);
    switch (clientGroup) {
      case WowClientGroup.BurningCrusade:
        return "bc";
      case WowClientGroup.Classic:
        return "classic";
      case WowClientGroup.Retail:
        return "retail";
      case WowClientGroup.WOTLK:
        return "wotlk";
      case WowClientGroup.Cata:
        return "cata";
      case WowClientGroup.Mists:
        return "mop";
      default:
        throw new Error(`[wago] Un-handled client type: ${clientType}`);
    }
  }

  private onWagoTokenReceived = (evt, token: string) => {
    console.log(`[wago] onWagoTokenReceived: ${token.length}`);
    if (!this.isValidToken(token)) {
      console.warn("[wagp] malformed token detected");
      return;
    }

    // Whenever we get a new token, manually re-enable the circuit breaker
    this._circuitBreaker.close();

    this._apiTokenSrc.next(token);
  };

  private getRequestHeaders(): {
    [header: string]: string;
  } {
    return {
      Authorization: `Bearer ${this.getToken()}`,
    };
  }

  private isValidToken(token: string) {
    return typeof token === "string" && token.length > 20;
  }

  //
  private ensureToken(timeoutMs = 10000): Observable<string> {
    if (this._circuitBreaker.isOpen()) {
      throw new Error("[wago] circuit breaker is open");
    }

    // if we have a secret set, use that
    if (this.isValidToken(this._wagoSecret)) {
      console.log("[wago] using secret", this._wagoSecret.length);
      return of(this._wagoSecret);
    }

    // wait for a public token from the ad frame
    return this._apiTokenSrc.pipe(
      timeout(timeoutMs),
      first((token) => this.isValidToken(token)),
      tap((token) => console.log(`[wago] token ready`, token.length)),
      catchError(() => {
        console.error("[wago] no token received after timeout");
        return of("");
      }),
    );
  }
}
