import { AddonSearchResult } from "app/models/wowup/addon-search-result";

export class GetAddonListItem {
  public readonly searchResult: AddonSearchResult;

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
}
