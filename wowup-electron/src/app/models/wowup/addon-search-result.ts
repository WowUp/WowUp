import { AddonSearchResultFile } from "./addon-search-result-file";

export interface AddonSearchResult {
  author: string;
  downloadCount?: number;
  externalId: string;
  externalUrl: string;
  files?: AddonSearchResultFile[];
  name: string;
  providerName: string;
  screenshotUrl?: string;
  screenshotUrls?: string[];
  summary?: string;
  thumbnailUrl: string;
  releasedAt?: Date;
}
