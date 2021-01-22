import * as _ from "lodash";

import { AddonChannelType } from "../models/wowup/addon-channel-type";
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

  public installState: AddonInstallState = AddonInstallState.Unknown;

  constructor(searchResult: AddonSearchResult, defaultAddonChannel: AddonChannelType) {
    this.searchResult = searchResult;
    this.author = this.searchResult.author;
    this.name = this.searchResult.name;
    this.providerName = this.searchResult.providerName;
    this.thumbnailUrl = this.searchResult.thumbnailUrl;
    this.downloadCount = this.searchResult.downloadCount || 0;
    this.releasedAt = new Date(SearchResults.getLatestFile(searchResult, defaultAddonChannel)?.releaseDate).getTime();
  }
}
