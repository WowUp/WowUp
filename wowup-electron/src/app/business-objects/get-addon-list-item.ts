import * as _ from "lodash";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonInstallState } from "../models/wowup/addon-install-state";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";

export class GetAddonListItem {
  public readonly searchResult: AddonSearchResult;

  public installState: AddonInstallState = AddonInstallState.Unknown;

  get downloadCount() {
    return this.searchResult.downloadCount || 0;
  }

  get name() {
    return this.searchResult.name;
  }

  get thumbnailUrl() {
    return this.searchResult.thumbnailUrl;
  }

  get author() {
    return this.searchResult.author;
  }

  get providerName() {
    return this.searchResult.providerName;
  }

  constructor(searchResult: AddonSearchResult) {
    this.searchResult = searchResult;
  }

  public getLatestFile(channel: AddonChannelType): AddonSearchResultFile {
    return _.find(this.searchResult.files, (f) => f.channelType <= channel);
  }
}
