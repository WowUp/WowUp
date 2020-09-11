import { AddonSearchResultFile } from "./addon-search-result-file";

export interface AddonSearchResult {
  name: string;
  author: string;
  thumbnailUrl: string;
  externalId: string;
  externalUrl: string;
  providerName: string;
  files: AddonSearchResultFile[];
}