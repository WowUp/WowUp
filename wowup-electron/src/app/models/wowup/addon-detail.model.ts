import { AddonProviderType } from "app/addon-providers/addon-provider";

export class AddonDetailModel {
  id: number;
  categoryId: number;
  version: string;
  name: string;
  author: string;
  description: string;
  summary: string;
  providerName: AddonProviderType;
  externalUrl: string;
  downloads: number;
  downloadUri: string;
  thumbnailUrl: string;
  screenshotUrls: string[];
  latestVersion?: string;
  updatedAt?: Date;

  constructor(json: any) {
    this.id = json.id;
    this.categoryId = json.categoryId;
    this.version = json.version;
    this.name = json.name;
    this.author = json.author;
    this.description = json.description;
    this.summary = json.summary;
    this.providerName = json.providerName;
    this.downloads = json.downloads;
    this.downloadUri = json.downloadUri;
    this.thumbnailUrl = json.thumbnailUrl;
    this.screenshotUrls = json.screenshotUrls;
    this.latestVersion = json.latestVersion;
    this.updatedAt = json.updatedAt;
    this.externalUrl = json.externalUrl;
  }
}
