import * as _ from "lodash";

import { AddonChannelType } from "../../common/wowup/models";
import { AddonInstallState } from "../models/wowup/addon-install-state";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
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

  public installState: AddonInstallState = AddonInstallState.Unknown;

  public get externalId(): string {
    return this.searchResult.externalId;
  }

  public constructor(searchResult: AddonSearchResult, defaultAddonChannel: AddonChannelType) {
    this.searchResult = searchResult;
    this.author = this.searchResult.author;
    this.name = this.searchResult.name;
    this.providerName = this.searchResult.providerName;
    this.thumbnailUrl = this.searchResult.thumbnailUrl;
    this.downloadCount = this.searchResult.downloadCount || 0;

    const latestFile = SearchResults.getLatestFile(searchResult, defaultAddonChannel);
    this.latestAddonChannel = latestFile.channelType;

    this.releasedAt = new Date(latestFile?.releaseDate).getTime();
  }
}
