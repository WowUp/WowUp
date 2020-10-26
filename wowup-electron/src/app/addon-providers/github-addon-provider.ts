import { HttpClient } from "@angular/common/http";
import { Addon } from "../entities/addon";
import { GitHubRelease } from "../models/github/github-release";
import { WowClientType } from "../models/warcraft/wow-client-type";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonFolder } from "../models/wowup/addon-folder";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { forkJoin, Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import { AddonProvider } from "./addon-provider";
import * as _ from "lodash";
import { extname } from "path";
import { GitHubAsset } from "../models/github/github-asset";
import { GitHubRepository } from "../models/github/github-repository";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";

const API_URL = "https://api.github.com/repos";
const RELEASE_CONTENT_TYPES = [
  "application/x-zip-compressed",
  "application/zip",
];

export class GitHubAddonProvider implements AddonProvider {
  public readonly name = "GitHub";

  constructor(private _httpClient: HttpClient) {}

  async getAll(
    clientType: WowClientType,
    addonIds: string[]
  ): Promise<AddonSearchResult[]> {
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

  async getFeaturedAddons(
    clientType: WowClientType
  ): Promise<AddonSearchResult[]> {
    return [];
  }

  async searchByQuery(
    query: string,
    clientType: WowClientType
  ): Promise<AddonSearchResult[]> {
    return [];
  }

  async searchByUrl(
    addonUri: URL,
    clientType: WowClientType
  ): Promise<AddonSearchResult> {
    const repoPath = addonUri.pathname;
    const repoExtension = extname(repoPath); // if the repo has the git extension it wont work?
    if (!repoPath || repoExtension) {
      throw new Error(`Invlaid URL: ${addonUri}`);
    }

    const results = await this.getReleases(repoPath).toPromise();
    const latestRelease = this.getLatestRelease(results);
    const asset = this.getValidAsset(latestRelease, clientType);

    if (asset == null) {
      throw new Error(`No release found: ${addonUri}`);
    }

    var repository = await this.getRepository(repoPath).toPromise();
    var author = repository.owner.login;
    var authorImageUrl = repository.owner.avatar_url;

    var potentialAddon: AddonSearchResult = {
      author: author,
      downloadCount: asset.download_count,
      externalId: repoPath,
      externalUrl: repository.html_url,
      name: repository.name,
      providerName: this.name,
      thumbnailUrl: authorImageUrl,
    };

    return potentialAddon;
  }

  async searchByName(
    addonName: string,
    folderName: string,
    clientType: WowClientType,
    nameOverride?: string
  ): Promise<AddonSearchResult[]> {
    return [];
  }

  getById(
    addonId: string,
    clientType: WowClientType
  ): Observable<AddonSearchResult> {
    return forkJoin([
      this.getReleases(addonId),
      this.getRepository(addonId),
    ]).pipe(
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

  isValidAddonUri(addonUri: URL): boolean {
    return addonUri.host && addonUri.host.endsWith("github.com");
  }

  onPostInstall(addon: Addon): void {}

  async scan(
    clientType: WowClientType,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {}

  private getLatestRelease(releases: GitHubRelease[]): GitHubRelease {
    let sortedReleases = _.filter(releases, (r) => !r.draft);
    sortedReleases = _.sortBy(
      sortedReleases,
      (release) => new Date(release.published_at)
    ).reverse();

    return _.first(sortedReleases);
  }

  private getValidAsset(
    release: GitHubRelease,
    clientType: WowClientType
  ): GitHubAsset {
    const sortedAssets = _.filter(
      release.assets,
      (asset) =>
        this.isNotNoLib(asset) &&
        this.isValidContentType(asset) &&
        this.isValidClientType(clientType, asset)
    );

    return _.first(sortedAssets);
  }

  private isNotNoLib(asset: GitHubAsset): boolean {
    return asset.name.toLowerCase().indexOf("-nolib") === -1;
  }

  private isValidContentType(asset: GitHubAsset): boolean {
    return RELEASE_CONTENT_TYPES.some((ct) => ct == asset.content_type);
  }

  private isValidClientType(
    clientType: WowClientType,
    asset: GitHubAsset
  ): boolean {
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

  private getReleases(repositoryPath: string): Observable<GitHubRelease[]> {
    const url = `${API_URL}${repositoryPath}/releases`;
    return this._httpClient.get<GitHubRelease[]>(url.toString());
  }

  private getRepository(repositoryPath: string): Observable<GitHubRepository> {
    const url = `${API_URL}${repositoryPath}`;
    return this._httpClient.get<GitHubRepository>(url.toString());
  }
}
