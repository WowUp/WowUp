import { WowClientType } from "../models/warcraft/wow-client-type";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonDependency } from "../models/wowup/addon-dependency";

export interface AddonExternalId {
  providerName: string;
  id: string;
}

export interface Addon {
  id: string;
  name: string;
  downloadUrl?: string;
  installedVersion?: string;
  latestVersion?: string;
  installedAt?: Date;
  externalId?: string;
  externalChannel?: string;
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
  externalIds?: AddonExternalId[];
  dependencies?: AddonDependency[];
}
