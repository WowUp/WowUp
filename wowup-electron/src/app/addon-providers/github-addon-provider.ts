import * as _ from "lodash";
import { from, Observable } from "rxjs";

import { HttpClient, HttpErrorResponse, HttpHeaders } from "@angular/common/http";

import { ADDON_PROVIDER_GITHUB } from "../../common/constants";
import {
  AssetMissingError,
  BurningCrusadeAssetMissingError,
  ClassicAssetMissingError,
  GitHubError,
  GitHubFetchReleasesError,
  GitHubFetchRepositoryError,
  GitHubLimitError,
  SourceRemovedAddonError,
} from "../errors";
import { GitHubAsset } from "../models/github/github-asset";
import { GitHubRelease } from "../models/github/github-release";
import { GitHubRepository } from "../models/github/github-repository";
import { WowClientType } from "../../common/warcraft/wow-client-type";
import { AddonChannelType } from "../../common/wowup/models";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";
import { AddonProvider, GetAllResult } from "./addon-provider";
import { WowInstallation } from "../models/wowup/wow-installation";
import { convertMarkdown } from "../utils/markdown.utlils";

interface GitHubRepoParts {
  repository: string;
  owner: string;
}

const API_URL = "https://api.github.com/repos";
const RELEASE_CONTENT_TYPES = ["application/x-zip-compressed", "application/zip"];
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
  public enabled = true;

  public constructor(private _httpClient: HttpClient) {
    super();
  }

  public async getAll(installation: WowInstallation, addonIds: string[]): Promise<GetAllResult> {
    const searchResults: AddonSearchResult[] = [];
    const errors: Error[] = [];

    for (const addonId of addonIds) {
      try {
        const result = await this.getByIdAsync(addonId, installation.clientType);
        if (result == null) {
          continue;
        }

        searchResults.push(result);
      } catch (e) {
        // If we're at the limit, just give up the loop
        if (e instanceof GitHubLimitError) {
          throw e;
        }

        if (e instanceof SourceRemovedAddonError) {
          e.addonId = addonId;
        }

        errors.push(e);
      }
    }

    return {
      errors,
      searchResults,
    };
  }

  public async searchByUrl(addonUri: URL, installation: WowInstallation): Promise<AddonSearchResult> {
    const repoPath = addonUri.pathname;
    if (!repoPath) {
      throw new Error(`Invalid URL: ${addonUri.toString()}`);
    }

    try {
      const results = await this.getReleases(repoPath);
      // const latestRelease = this.getLatestRelease(results);
      // if (!latestRelease) {
      //   console.log("latestRelease results", results);
      //   throw new NoReleaseFoundError(addonUri.toString());
      // }

      const result = this.getLatestValidAsset(results, installation.clientType, installation.defaultAddonChannelType);
      console.log("result", result);
      if (!result) {
        if ([WowClientType.Classic, WowClientType.ClassicPtr].includes(installation.clientType)) {
          throw new ClassicAssetMissingError(addonUri.toString());
        } else if ([WowClientType.ClassicBeta].includes(installation.clientType)) {
          throw new BurningCrusadeAssetMissingError(addonUri.toString());
        } else {
          throw new AssetMissingError(addonUri.toString());
        }
        // throw new Error(`No release assets found in ${addonUri}`);
      }

      const repository = await this.getRepository(repoPath);
      const author = repository.owner.login;
      const authorImageUrl = repository.owner.avatar_url;

      const potentialAddon: AddonSearchResult = {
        author: author,
        downloadCount: result.asset.download_count,
        externalId: this.createExternalId(addonUri),
        externalUrl: repository.html_url,
        name: repository.name,
        providerName: this.name,
        thumbnailUrl: authorImageUrl,
        files: [
          {
            channelType: result.release.prerelease ? AddonChannelType.Beta : AddonChannelType.Stable,
            downloadUrl: "",
            folders: [],
            gameVersion: "",
            releaseDate: new Date(result.release.published_at),
            version: result.asset.name,
          },
        ],
      };

      return potentialAddon;
    } catch (e) {
      console.error("searchByUrl failed", e);
      throw e;
    }
  }

  private createExternalId(addonUri: URL) {
    const parsed = this.parseRepoPath(addonUri.pathname);
    return `${parsed.owner}/${parsed.repository}`;
  }

  public getById(addonId: string, installation: WowInstallation): Observable<AddonSearchResult> {
    return from(this.getByIdAsync(addonId, installation.clientType));
  }

  private async getByIdAsync(addonId: string, clientType: WowClientType) {
    const repository = await this.getRepository(addonId);
    const releases = await this.getReleases(addonId);

    if (!releases?.length) {
      return undefined;
    }

    const latestRelease = this.getLatestRelease(releases);
    if (!latestRelease) {
      return undefined;
    }

    const asset = this.getValidAsset(latestRelease, clientType);
    if (!asset) {
      return undefined;
    }

    const author = repository.owner.login;
    const authorImageUrl = repository.owner.avatar_url;
    const addonName = this.getAddonName(addonId);

    console.debug("latestRelease", latestRelease);
    console.debug("asset", asset);

    const searchResultFile: AddonSearchResultFile = {
      channelType: AddonChannelType.Stable,
      downloadUrl: asset.browser_download_url,
      folders: [addonName],
      gameVersion: "",
      version: asset.name,
      releaseDate: new Date(asset.created_at),
      changelog: convertMarkdown(latestRelease.body),
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
    return addonUri.host && addonUri.host.endsWith("github.com");
  }

  public isValidAddonId(addonId: string): boolean {
    return addonId.indexOf("/") !== -1;
  }

  private getLatestValidAsset(
    releases: GitHubRelease[],
    clientType: WowClientType,
    channel: AddonChannelType
  ): { asset: GitHubAsset; release: GitHubRelease } | undefined {
    let sortedReleases = _.filter(releases, (r) => !r.draft);
    sortedReleases = _.sortBy(sortedReleases, (release) => new Date(release.published_at)).reverse();

    for (const release of sortedReleases) {
      const validAsset = this.getValidAsset(release, clientType);
      if (validAsset) {
        return {
          asset: validAsset,
          release: release,
        };
      }
    }

    return undefined;
  }

  private getLatestRelease(releases: GitHubRelease[]): GitHubRelease {
    let sortedReleases = _.filter(releases, (r) => !r.draft);
    sortedReleases = _.sortBy(sortedReleases, (release) => new Date(release.published_at)).reverse();

    return _.first(sortedReleases);
  }

  private getValidAsset(release: GitHubRelease, clientType: WowClientType): GitHubAsset {
    const sortedAssets = _.filter(
      release.assets,
      (asset) => this.isNotNoLib(asset) && this.isValidContentType(asset) && this.isValidClientType(clientType, asset)
    );

    return _.first(sortedAssets);
  }

  private isNotNoLib(asset: GitHubAsset): boolean {
    return asset.name.toLowerCase().indexOf("-nolib") === -1;
  }

  private isValidContentType(asset: GitHubAsset): boolean {
    return RELEASE_CONTENT_TYPES.some((ct) => ct == asset.content_type);
  }

  private isValidClientType(clientType: WowClientType, asset: GitHubAsset): boolean {
    const isClassic = this.isClassicAsset(asset);
    const isBurningCrusade = this.isBurningCrusadeAsset(asset);

    switch (clientType) {
      case WowClientType.Retail:
      case WowClientType.RetailPtr:
      case WowClientType.Beta:
        return !isClassic && !isBurningCrusade;
      case WowClientType.Classic:
      case WowClientType.ClassicPtr:
        return isClassic;
      case WowClientType.ClassicBeta:
        return isBurningCrusade;
      default:
        return false;
    }
  }

  private isClassicAsset(asset: GitHubAsset): boolean {
    return asset.name.toLowerCase().endsWith("-classic.zip");
  }

  private isBurningCrusadeAsset(asset: GitHubAsset): boolean {
    return asset.name.toLowerCase().endsWith("-bc.zip");
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

      throw new GitHubFetchReleasesError(repositoryPath, e);
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

      throw new GitHubFetchRepositoryError(repositoryPath, e);
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
    return parseInt(headers.get(key), 10);
  }

  private async getWithRateLimit<T>(url: URL | string): Promise<T> {
    try {
      return await this._httpClient.get<T>(url.toString()).toPromise();
    } catch (e) {
      this.handleRateLimitError(e);
      this.handleNotFoundError(e);
      throw e;
    }
  }

  private parseRepoPath(repositoryPath: string): GitHubRepoParts {
    const regex = /\/?(.*?)\/(.*?)(\/.*|\.git.*)?$/;
    const matches = regex.exec(repositoryPath);

    return {
      owner: matches[1],
      repository: matches[2],
    };
  }
}
