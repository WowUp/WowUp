import { WowClientType } from "../models/warcraft/wow-client-type";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonDependency } from "../models/wowup/addon-dependency";

export interface AddonExternalId {
  providerName: string;
  id: string;
}

export interface AddonFundingLink {
  platform: string;
  url: string;
}

export interface Addon {
  id: string;
  name: string;
  downloadUrl?: string;
  installedVersion?: string;
  installedExternalReleaseId?: string;
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
  installedFolderList?: string[];
  isIgnored: boolean;
  isLoadOnDemand: boolean;
  autoUpdateEnabled: boolean;
  clientType: WowClientType;
  channelType: AddonChannelType;
  updatedAt?: Date;
  fundingLinks?: AddonFundingLink[];
  downloadCount?: number;
  summary?: string;
  screenshotUrls?: string[];
  releasedAt?: Date;
  externalIds?: AddonExternalId[];
  externalLatestReleaseId?: string;
  latestChangelogVersion?: string;
  latestChangelog?: string;
  dependencies?: AddonDependency[];
  missingDependencies?: string[];
  ignoreReason?: AddonIgnoreReason;
}
