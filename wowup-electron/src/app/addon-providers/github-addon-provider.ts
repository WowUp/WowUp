import * as _ from "lodash";
import { firstValueFrom, from, mergeMap, toArray } from "rxjs";

import { HttpClient, HttpErrorResponse, HttpHeaders } from "@angular/common/http";

import { ADDON_PROVIDER_GITHUB, PREF_GITHUB_PERSONAL_ACCESS_TOKEN } from "../../common/constants";
import {
  AssetMissingError,
  GitHubError,
  GitHubFetchReleasesError,
  GitHubFetchRepositoryError,
  GitHubLimitError,
  SourceRemovedAddonError,
} from "../errors";
import { convertMarkdown } from "../utils/markdown.utlils";
import { strictFilterBy } from "../utils/array.utils";
import { getWowClientGroup } from "../../common/warcraft";
import { SensitiveStorageService } from "../services/storage/sensitive-storage.service";
import {
  AddonChannelType,
  AddonProvider,
  AddonSearchResult,
  AddonSearchResultFile,
  DownloadAuth,
  GetAllResult,
  SearchByUrlResult,
  WowClientType,
} from "wowup-lib-core";
import { GitHubAsset, GitHubRelease, GitHubRepository, WowInstallation } from "wowup-lib-core/lib/models";

type MetadataFlavor = "bcc" | "classic" | "mainline" | "wrath";

interface LatestValidAsset {
  matchedAsset: GitHubAsset | undefined;
  release: GitHubRelease | undefined;
  latestAsset: GitHubAsset | undefined;
}

interface GitHubRepoParts {
  repository: string;
  owner: string;
}

interface ReleaseMeta {
  releases: ReleaseMetaItem[];
}

interface ReleaseMetaItem {
  filename: string;
  nolib: boolean;
  metadata: ReleaseMetaItemMetadata[];
}

interface ReleaseMetaItemMetadata {
  flavor: MetadataFlavor;
  interface: number;
}

const API_URL = "https://api.github.com/repos";
const RELEASE_CONTENT_TYPES = {
  XZIP: "application/x-zip-compressed",
  ZIP: "application/zip",
  OCTET_STREAM: "application/octet-stream",
};
const HEADER_RATE_LIMIT_MAX = "x-ratelimit-limit";
const HEADER_RATE_LIMIT_REMAINING = "x-ratelimit-remaining";
const HEADER_RATE_LIMIT_RESET = "x-ratelimit-reset";
const HEADER_RATE_LIMIT_USED = "x-ratelimit-used";

export class GitHubAddonProvider extends AddonProvider {
  public readonly name = ADDON_PROVIDER_GITHUB;
  public readonly forceIgnore = false;
  public readonly allowReinstall = true;
  public readonly allowChannelChange = false;
  public readonly allowEdit = false;
  public readonly allowReScan = false;
  public enabled = true;

  public constructor(private _httpClient: HttpClient, private _sensitiveStorageService: SensitiveStorageService) {
    super();
  }

  public async getDownloadAuth(): Promise<DownloadAuth | undefined> {
    const hasPat = await this.hasPersonalAccessKey();
    if (hasPat) {
      const headers = await this.getAuthorizationHeader();
      headers.Accept = "application/octet-stream";

      return {
        headers,
      };
    } else {
      return undefined;
    }
  }

  public async getAll(installation: WowInstallation, addonIds: string[]): Promise<GetAllResult> {
    const taskResults = await firstValueFrom(
      from(addonIds).pipe(
        mergeMap((addonId) => from(this.handleGetAllItem(addonId, installation)), 3),
        toArray()
      )
    );

    const result: GetAllResult = {
      errors: _.concat(taskResults.map((tr) => tr.error).filter((e): e is Error => e !== undefined)),
      searchResults: _.concat(
        taskResults.map((tr) => tr.searchResult).filter((sr): sr is AddonSearchResult => sr !== undefined)
      ),
    };

    return result;
  }

  private async handleGetAllItem(
    addonId: string,
    installation: WowInstallation
  ): Promise<{ searchResult: AddonSearchResult | undefined; error: Error | undefined }> {
    const result: { searchResult: AddonSearchResult | undefined; error: Error | undefined } = {
      searchResult: undefined,
      error: undefined,
    };

    try {
      result.searchResult = await this.getByIdAsync(addonId, installation);
    } catch (e) {
      // If we're at the limit, just give up the loop
      if (e instanceof GitHubLimitError) {
        throw e;
      }

      if (e instanceof SourceRemovedAddonError) {
        e.addonId = addonId;
      }

      result.error = e as Error;
    }

    return result;
  }

  public async searchByUrl(addonUri: URL, installation: WowInstallation): Promise<SearchByUrlResult> {
    const repoPath = addonUri.pathname;
    if (!repoPath) {
      throw new Error(`Invalid URL: ${addonUri.toString()}`);
    }

    const searchByUrlResult: SearchByUrlResult = {
      errors: [],
      searchResult: undefined,
    };

    const clientGroup = getWowClientGroup(installation.clientType);

    try {
      const results = await this.getReleases(repoPath);

      const prereleaseRes = results.filter((res) => res.prerelease);
      const stableRes = results.filter((res) => !res.prerelease);
      let checkRes = stableRes.length === 0 ? prereleaseRes : stableRes;
      if (installation.defaultAddonChannelType !== AddonChannelType.Stable) {
        checkRes = results;
      }

      const result = await this.getLatestValidAsset(checkRes, installation.clientType);
      console.log("searchByUrl result", result);
      if (!result.matchedAsset && !result.latestAsset) {
        throw new AssetMissingError(addonUri.toString(), clientGroup);
      }

      const hasPat = await this.hasPersonalAccessKey();
      const repository = await this.getRepository(repoPath);
      const author = repository.owner.login;
      const authorImageUrl = repository.owner.avatar_url;

      const asset = result.matchedAsset || result.latestAsset;
      const potentialAddon: AddonSearchResult = {
        author: author,
        downloadCount: asset?.download_count ?? 0,
        externalId: this.createExternalId(addonUri),
        externalUrl: repository.html_url,
        name: repository.name,
        providerName: this.name,
        thumbnailUrl: authorImageUrl,
        files: [
          {
            channelType: result.release?.prerelease ? AddonChannelType.Beta : AddonChannelType.Stable,
            downloadUrl: (hasPat ? asset?.url : asset?.browser_download_url) ?? "",
            folders: [],
            gameVersion: "",
            releaseDate: new Date(result.release?.published_at ?? ""),
            version: asset?.name ?? "",
          },
        ],
      };

      // If there was not an exact match, throw an error with the addon we created as the metadata
      if (!result.matchedAsset) {
        searchByUrlResult.errors?.push(new AssetMissingError(addonUri.toString()));
      }

      searchByUrlResult.searchResult = potentialAddon;
    } catch (e) {
      console.error("searchByUrl failed", e);
      throw e;
    }

    return searchByUrlResult;
  }

  private createExternalId(addonUri: URL) {
    const parsed = this.parseRepoPath(addonUri.pathname);
    return `${parsed.owner}/${parsed.repository}`;
  }

  public override async getById(
    addonId: string,
    installation: WowInstallation
  ): Promise<AddonSearchResult | undefined> {
    return await this.getByIdAsync(addonId, installation);
  }

  private async getByIdAsync(addonId: string, installation: WowInstallation) {
    const repository = await this.getRepository(addonId);
    const releases = await this.getReleases(addonId);
    if (!releases?.length) {
      return undefined;
    }

    const prereleaseRes = releases.filter((res) => res.prerelease);
    const stableRes = releases.filter((res) => !res.prerelease);
    let checkRes = stableRes.length === 0 ? prereleaseRes : stableRes;
    if (installation.defaultAddonChannelType !== AddonChannelType.Stable) {
      checkRes = releases;
    }

    const assetResult = await this.getLatestValidAsset(checkRes, installation.clientType);
    if (!assetResult.matchedAsset && !assetResult.latestAsset) {
      return undefined;
    }
    console.debug("assetResult", assetResult);

    const author = repository.owner.login;
    const authorImageUrl = repository.owner.avatar_url;
    const addonName = this.getAddonName(addonId);
    const asset = assetResult.matchedAsset || assetResult.latestAsset;
    console.debug("asset", asset);

    const hasPat = await this.hasPersonalAccessKey();

    const searchResultFile: AddonSearchResultFile = {
      channelType: AddonChannelType.Stable,
      downloadUrl: (hasPat ? asset?.url : asset?.browser_download_url) ?? "",
      folders: [addonName],
      gameVersion: "",
      version: asset?.name ?? "",
      releaseDate: new Date(asset?.created_at ?? ""),
      changelog: convertMarkdown(assetResult?.release?.body ?? ""),
    };

    const searchResult: AddonSearchResult = {
      author: author,
      externalId: addonId,
      externalUrl: repository.html_url,
      files: [searchResultFile],
      name: addonName,
      providerName: this.name,
      thumbnailUrl: authorImageUrl,
      summary: repository.description,
    };

    return searchResult;
  }

  public isValidAddonUri(addonUri: URL): boolean {
    return !!addonUri.host && addonUri.host.endsWith("com");
  }

  public isValidAddonId(addonId: string): boolean {
    return addonId.indexOf("/") !== -1;
  }

  private async getLatestValidAsset(releases: GitHubRelease[], clientType: WowClientType): Promise<LatestValidAsset> {
    let sortedReleases = releases.filter((r) => !r.draft);
    sortedReleases = _.sortBy(sortedReleases, (release) => new Date(release.published_at)).reverse();
    sortedReleases = _.take(sortedReleases, 5);

    let validAsset: GitHubAsset | undefined = undefined;
    let latestRelease: GitHubRelease | undefined = _.first(sortedReleases);
    let latestAsset = this.getValidAssetForAny(latestRelease);

    for (const release of sortedReleases) {
      let iAsset: GitHubAsset | undefined = undefined;
      if (this.hasReleaseMetadata(release)) {
        console.log(`Checking release metadata: ${release.name}`);
        const metadata = await this.getReleaseMetadata(release);
        iAsset = this.getValidAssetFromMetadata(release, clientType, metadata);
      }

      // If we didn't find an asset with metadata, try the old way
      if (!iAsset) {
        iAsset = this.getValidAsset(release, clientType);
      }

      if (iAsset) {
        validAsset = iAsset;
        latestRelease = release;
        latestAsset = this.getValidAssetForAny(latestRelease);
        break;
      }
    }

    return {
      matchedAsset: validAsset,
      release: latestRelease,
      latestAsset: latestAsset,
    };
  }

  private getLatestRelease(releases: GitHubRelease[]): GitHubRelease {
    let sortedReleases = strictFilterBy(releases, (r) => !r.draft);
    sortedReleases = _.sortBy(sortedReleases, (release) => new Date(release.published_at)).reverse();
    const firstItem = _.first(sortedReleases);
    if (firstItem === undefined) {
      throw new Error("No releases found");
    }

    return firstItem;
  }

  /** Fetch the json object for the BigWigs metadata json file */
  private async getReleaseMetadata(release: GitHubRelease): Promise<ReleaseMeta> {
    const metadataAsset = release.assets.find((asset) => asset.name === "release.json");
    if (!metadataAsset) {
      throw new Error("No metadata asset found");
    }

    const hasPat = await this.hasPersonalAccessKey();
    const url = hasPat ? metadataAsset.url : metadataAsset.browser_download_url;

    return await this.getWithRateLimit<ReleaseMeta>(url, hasPat);
  }

  /** Check if any of the assets are the BigWigs metadata json file */
  private hasReleaseMetadata(release: GitHubRelease): boolean {
    return release.assets.findIndex((asset) => asset.name === "release.json") !== -1;
  }

  /** Return the valid zip file asset for a given client type combined with the BigWigs metadata */
  private getValidAssetFromMetadata(
    release: GitHubRelease,
    clientType: WowClientType,
    releaseMeta: ReleaseMeta
  ): GitHubAsset | undefined {
    // map the client type to the flavor we want
    const targetFlavor = this.getMetadataTargetFlavor(clientType);
    console.log(`Target metadata flavor: ${targetFlavor}`);

    // see if we can find that flavor in the metadata
    const targetMetaRelease = releaseMeta.releases.find(
      (release) => release.nolib === false && release.metadata.findIndex((m) => m.flavor === targetFlavor) !== -1
    );
    if (!targetMetaRelease) {
      console.log(`No matching metadata file found for target`);
      return undefined;
    }

    console.log(`Target metadata release: ${targetMetaRelease.filename}`);

    // return any matching valid asset with the metadata file name and content type
    return release.assets.find((asset) => this.isValidContentType(asset) && asset.name === targetMetaRelease.filename);
  }

  /** Return the BigWigs metadata flavor for a given client type */
  private getMetadataTargetFlavor(clientType: WowClientType): MetadataFlavor {
    switch (clientType) {
      case WowClientType.Classic:
      case WowClientType.ClassicPtr:
      case WowClientType.ClassicBeta:
        return "wrath";
      case WowClientType.ClassicEra:
      case WowClientType.ClassicEraPtr:
        return "classic";
      case WowClientType.Beta:
      case WowClientType.Retail:
      case WowClientType.RetailPtr:
        return "mainline";
      default:
        throw new Error("Unknown client type for metadata");
    }
  }

  private getValidAsset(release: GitHubRelease, clientType: WowClientType): GitHubAsset | undefined {
    const sortedAssets = _.filter(
      release.assets,
      (asset) => this.isNotNoLib(asset) && this.isValidContentType(asset) && this.isValidClientType(clientType, asset)
    );

    return _.first(sortedAssets);
  }

  private getValidAssetForAny(release: GitHubRelease | undefined): GitHubAsset | undefined {
    if (release === undefined) {
      return undefined;
    }

    const sortedAssets = _.filter(release.assets, (asset) => this.isNotNoLib(asset) && this.isValidContentType(asset));
    return _.first(sortedAssets);
  }

  private getSortedAssets(release: GitHubRelease): GitHubAsset[] {
    return release.assets.filter((asset) => this.isNotNoLib(asset) && this.isValidContentType(asset));
  }

  private isNotNoLib(asset: GitHubAsset): boolean {
    return asset.name.toLowerCase().indexOf("-nolib") === -1;
  }

  private isValidContentType(asset: GitHubAsset): boolean {
    if ([RELEASE_CONTENT_TYPES.ZIP, RELEASE_CONTENT_TYPES.XZIP].includes(asset.content_type)) {
      return true;
    }

    if (RELEASE_CONTENT_TYPES.OCTET_STREAM === asset.content_type && asset.browser_download_url.endsWith(".zip")) {
      return true;
    }

    return false;
  }

  private isValidClientType(clientType: WowClientType, asset: GitHubAsset): boolean {
    const isClassic = this.isClassicAsset(asset);
    const isBurningCrusade = this.isBurningCrusadeAsset(asset);
    const isWotlk = this.isWotlk(asset);

    switch (clientType) {
      case WowClientType.Retail:
      case WowClientType.RetailPtr:
      case WowClientType.Beta:
        return !isClassic && !isBurningCrusade && !isWotlk;
      case WowClientType.ClassicEra:
      case WowClientType.ClassicEraPtr:
        return isClassic;
      case WowClientType.Classic:
      case WowClientType.ClassicPtr:
      case WowClientType.ClassicBeta:
        return isWotlk;
      default:
        return false;
    }
  }

  private isClassicAsset(asset: GitHubAsset): boolean {
    return /[-_](classic|vanilla)\.zip$/i.test(asset.name);
  }

  private isBurningCrusadeAsset(asset: GitHubAsset): boolean {
    return /[-_](bc|bcc|tbc)\.zip$/i.test(asset.name);
  }

  private isWotlk(asset: GitHubAsset): boolean {
    return /[-_](wrath|wotlkc)\.zip$/i.test(asset.name);
  }

  private getAddonName(addonId: string): string {
    return addonId.split("/").filter((str) => !!str)[1];
  }

  private async getReleases(repositoryPath: string): Promise<GitHubRelease[]> {
    const parsed = this.parseRepoPath(repositoryPath);
    try {
      return await this.getReleasesByParts(parsed);
    } catch (e) {
      console.error(`Failed to get GitHub releases`, e);
      // If some other internal handler already handled this, use that error
      if (e instanceof GitHubError) {
        throw e;
      }

      throw new GitHubFetchReleasesError(repositoryPath, e as Error);
    }
  }

  private getReleasesByParts(repoParts: GitHubRepoParts): Promise<GitHubRelease[]> {
    const url = `${API_URL}/${repoParts.owner}/${repoParts.repository}/releases`;
    return this.getWithRateLimit<GitHubRelease[]>(url);
  }

  private async getRepository(repositoryPath: string): Promise<GitHubRepository> {
    const parsed = this.parseRepoPath(repositoryPath);
    try {
      return await this.getRepositoryByParts(parsed);
    } catch (e) {
      console.error(`Failed to get GitHub repository`, e);
      // If some other internal handler already handled this, use that error
      if (e instanceof GitHubError || e instanceof SourceRemovedAddonError) {
        throw e;
      }

      throw new GitHubFetchRepositoryError(repositoryPath, e as Error);
    }
  }

  private getRepositoryByParts(repoParts: GitHubRepoParts): Promise<GitHubRepository> {
    const url = `${API_URL}/${repoParts.owner}/${repoParts.repository}`;
    return this.getWithRateLimit<GitHubRepository>(url);
  }

  private handleRateLimitError(response: HttpErrorResponse) {
    if (response.status === 403) {
      const rateLimitMax = this.getIntHeader(response.headers, HEADER_RATE_LIMIT_MAX);
      const rateLimitUsed = this.getIntHeader(response.headers, HEADER_RATE_LIMIT_USED);
      const rateLimitRemaining = this.getIntHeader(response.headers, HEADER_RATE_LIMIT_REMAINING);
      const rateLimitReset = this.getIntHeader(response.headers, HEADER_RATE_LIMIT_RESET);

      if (rateLimitRemaining === 0) {
        throw new GitHubLimitError(rateLimitMax, rateLimitUsed, rateLimitRemaining, rateLimitReset);
      }
    }
  }

  private handleNotFoundError(response: HttpErrorResponse) {
    if (response.status === 404) {
      throw new SourceRemovedAddonError("", response);
    }
  }

  private getIntHeader(headers: HttpHeaders, key: string) {
    return parseInt(headers.get(key) ?? "", 10);
  }

  private async hasPersonalAccessKey(): Promise<boolean> {
    const pat = await this._sensitiveStorageService.getAsync(PREF_GITHUB_PERSONAL_ACCESS_TOKEN);
    return typeof pat === "string" && pat.length > 0;
  }

  private async getAuthorizationHeader(): Promise<{ [param: string]: string }> {
    const personalAccessToken = await this._sensitiveStorageService.getAsync(PREF_GITHUB_PERSONAL_ACCESS_TOKEN);
    const headers: { [param: string]: string } = {};
    if (typeof personalAccessToken === "string" && personalAccessToken.length > 0) {
      headers.Authorization = `token ${personalAccessToken}`;
    }

    return headers;
  }

  private async getWithRateLimit<T>(url: URL | string, expectBinary = false): Promise<T> {
    try {
      const headers = await this.getAuthorizationHeader();

      if (expectBinary) {
        headers.Accept = "application/octet-stream";
      }

      return await firstValueFrom(this._httpClient.get<T>(url.toString(), { headers }));
    } catch (e) {
      if (e instanceof HttpErrorResponse) {
        this.handleRateLimitError(e);
        this.handleNotFoundError(e);
      }
      throw e;
    }
  }

  private parseRepoPath(repositoryPath: string): GitHubRepoParts {
    const regex = /\/?(.*?)\/(.*?)(\/.*|\.git.*)?$/;
    const matches = regex.exec(repositoryPath);
    if (!matches) {
      throw new Error("No matches found");
    }

    return {
      owner: matches[1],
      repository: matches[2],
    };
  }
}
