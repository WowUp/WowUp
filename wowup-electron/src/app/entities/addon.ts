import { WowClientType } from "app/models/warcraft/wow-client-type";
import { AddonChannelType } from "app/models/wowup/addon-channel-type";

export interface Addon {
  id: string;
  name: string;
  folderName: string;
  downloadUrl?: string;
  installedVersion?: string;
  latestVersion?: string;
  installedAt?: Date;
  externalId?: string;
  providerName?: string;
  providerSource?: string;
  externalUrl?: string;
  thumbnailUrl?: string;
  gameVersion?: string;
  author?: string;
  installedFolders?: string;
  isIgnored: boolean;
  autoUpdateEnabled: boolean;
  clientType: WowClientType;
  channelType: AddonChannelType;
  updatedAt?: Date;
  patreonFundingLink?: string;
  githubFundingLink?: string;
  customFundingLink?: string;
  downloadCount?: number;
  summary?: string;
  screenshotUrls?: string[];
  releasedAt?: Date;
}