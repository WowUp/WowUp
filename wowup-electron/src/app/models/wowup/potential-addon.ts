export interface PotentialAddon {
  name: string;
  providerName: string;
  thumbnailUrl: string;
  screenshotUrl?: string;
  externalId: string;
  externalUrl: string;
  author: string;
  downloadCount: number;
  summary?: string;
  screenshotUrls?: string[];
  version?: string;
}
