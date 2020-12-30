import * as _ from "lodash";
import { forkJoin, Observable } from "rxjs";
import { map } from "rxjs/operators";

import { HttpClient, HttpErrorResponse, HttpHeaders } from "@angular/common/http";

import { ADDON_PROVIDER_GITHUB } from "../../common/constants";
import { Addon } from "../entities/addon";
import { AssetMissingError, ClassicAssetMissingError, GitHubLimitError, NoReleaseFoundError } from "../errors";
import { GitHubAsset } from "../models/github/github-asset";
import { GitHubRelease } from "../models/github/github-release";
import { GitHubRepository } from "../models/github/github-repository";
import { WowClientType } from "../models/warcraft/wow-client-type";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonFolder } from "../models/wowup/addon-folder";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";
import { AddonProvider } from "./addon-provider";

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

export class GitHubAddonProvider implements AddonProvider {
  public readonly name = ADDON_PROVIDER_GITHUB;
  public readonly forceIgnore = false;
  public readonly allowReinstall = true;
  public readonly allowChannelChange = false;
  public readonly allowEdit = false;
  public enabled = true;

  constructor(private _httpClient: HttpClient) {}

  public async getAll(clientType: WowClientType, addonIds: string[]): Promise<AddonSearchResult[]> {
    var searchResults: AddonSearchResult[] = [];

    for (let addonId of addonIds) {
      var result = await this.getById(addonId, clientType).toPromise();
      if (result == null) {
        continue;
      }

      searchResults.push(result);
    }

    return searchResults;
  }

  public async getFeaturedAddons(clientType: WowClientType): Promise<AddonSearchResult[]> {
    return [];
  }

  public async searchByQuery(query: string, clientType: WowClientType): Promise<AddonSearchResult[]> {
    return [];
  }

  public async getChangelog(clientType: WowClientType, externalId: string, externalReleaseId: string): Promise<string> {
    return "";
  }

  public async searchByUrl(addonUri: URL, clientType: WowClientType): Promise<AddonSearchResult> {
    const repoPath = addonUri.pathname;
    if (!repoPath) {
      throw new Error(`Invalid URL: ${addonUri}`);
    }

    try {
      const results = await this.getReleases(repoPath);
      const latestRelease = this.getLatestRelease(results);
      if (!latestRelease) {
        console.log("latestRelease results", results);
        throw new NoReleaseFoundError(addonUri.toString());
      }

      const asset = this.getValidAsset(latestRelease, clientType);
      console.log("latestRelease", latestRelease);
      if (asset == null) {
        if ([WowClientType.Classic, WowClientType.ClassicPtr].includes(clientType)) {
          throw new ClassicAssetMissingError(addonUri.toString());
        } else {
          throw new AssetMissingError(addonUri.toString());
        }
        // throw new Error(`No release assets found in ${addonUri}`);
      }

      var repository = await this.getRepository(repoPath);
      var author = repository.owner.login;
      var authorImageUrl = repository.owner.avatar_url;

      var potentialAddon: AddonSearchResult = {
        author: author,
        downloadCount: asset.download_count,
        externalId: this.createExternalId(addonUri),
        externalUrl: repository.html_url,
        name: repository.name,
        providerName: this.name,
        thumbnailUrl: authorImageUrl,
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

  public async searchByName(
    addonName: string,
    folderName: string,
    clientType: WowClientType,
    nameOverride?: string
  ): Promise<AddonSearchResult[]> {
    return [];
  }

  public getById(addonId: string, clientType: WowClientType): Observable<AddonSearchResult> {
    return forkJoin([this.getReleases(addonId), this.getRepository(addonId)]).pipe(
      map(([releases, repository]) => {
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

        var searchResultFile: AddonSearchResultFile = {
          channelType: AddonChannelType.Stable,
          downloadUrl: asset.browser_download_url,
          folders: [addonName],
          gameVersion: "",
          version: asset.name,
          releaseDate: new Date(asset.created_at),
        };

        var searchResult: AddonSearchResult = {
          author: author,
          externalId: addonId,
          externalUrl: repository.html_url,
          files: [searchResultFile],
          name: addonName,
          providerName: this.name,
          thumbnailUrl: authorImageUrl,
        };

        return searchResult;
      })
    );
  }

  public isValidAddonUri(addonUri: URL): boolean {
    return addonUri.host && addonUri.host.endsWith("github.com");
  }

  public isValidAddonId(addonId: string): boolean {
    return addonId.indexOf("/") !== -1;
  }

  public onPostInstall(addon: Addon): void {}

  public async scan(
    clientType: WowClientType,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {}

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

    switch (clientType) {
      case WowClientType.Retail:
      case WowClientType.RetailPtr:
      case WowClientType.Beta:
        return !isClassic;
      case WowClientType.Classic:
      case WowClientType.ClassicPtr:
        return isClassic;
      default:
        return false;
    }
  }

  private isClassicAsset(asset: GitHubAsset): boolean {
    return asset.name.toLowerCase().endsWith("-classic.zip");
  }

  private getAddonName(addonId: string): string {
    return addonId.split("/").filter((str) => !!str)[1];
  }

  private getReleases(repositoryPath: string): Promise<GitHubRelease[]> {
    const parsed = this.parseRepoPath(repositoryPath);
    return this.getReleasesByParts(parsed);
  }

  private getReleasesByParts(repoParts: GitHubRepoParts): Promise<GitHubRelease[]> {
    const url = `${API_URL}/${repoParts.owner}/${repoParts.repository}/releases`;
    return this.getWithRateLimit<GitHubRelease[]>(url);
  }

  private getRepository(repositoryPath: string): Promise<GitHubRepository> {
    const parsed = this.parseRepoPath(repositoryPath);
    return this.getRepositoryByParts(parsed);
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

  private getIntHeader(headers: HttpHeaders, key: string) {
    return parseInt(headers.get(key), 10);
  }

  private async getWithRateLimit<T>(url: URL | string, defaultValue = undefined): Promise<T> {
    try {
      return await this._httpClient.get<T>(url.toString()).toPromise();
    } catch (e) {
      this.handleRateLimitError(e);
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
