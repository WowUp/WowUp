import { AddonChannelType, AddonSearchResult } from "wowup-lib-core";
import { AddonInstallState } from "../models/wowup/addon-install-state";
import * as SearchResults from "../utils/search-result.utils";

export class GetAddonListItem {
  public readonly searchResult: AddonSearchResult;

  public releasedAt: number;
  public downloadCount: number;
  public name: string;
  public thumbnailUrl: string;
  public author: string;
  public providerName: string;
  public latestAddonChannel: AddonChannelType;
  public canonicalName: string;

  public installState: AddonInstallState = AddonInstallState.Unknown;

  public get externalId(): string {
    return this.searchResult.externalId;
  }

  public constructor(searchResult: AddonSearchResult, defaultAddonChannel?: AddonChannelType) {
    this.searchResult = searchResult;
    this.author = this.searchResult.author;
    this.name = this.searchResult.name;
    this.providerName = this.searchResult.providerName;
    this.thumbnailUrl = this.searchResult.thumbnailUrl;
    this.downloadCount = this.searchResult.downloadCount || 0;
    this.canonicalName = this.name.toLowerCase();

    if (defaultAddonChannel !== undefined) {
      const latestFile = SearchResults.getLatestFile(searchResult, defaultAddonChannel);
      this.latestAddonChannel = latestFile?.channelType ?? AddonChannelType.Stable;

      this.releasedAt = new Date(latestFile?.releaseDate ?? new Date()).getTime();
    }
  }
}
