import { FsStats } from './ipc';
import { Toc } from './toc';
import {
  AddonChannelType,
  AddonDependencyType,
  AddonIgnoreReason,
  AddonScanType,
  AddonWarningType,
  WowClientGroup,
  WowClientType,
} from './types';

export interface AddonSearchResultDependency {
  externalAddonId: string;
  type: AddonDependencyType;
}

export interface AddonSearchResultFile {
  externalId?: string;
  channelType: AddonChannelType;
  version: string;
  folders: string[];
  gameVersion: string;
  downloadUrl: string;
  releaseDate: Date;
  dependencies?: AddonSearchResultDependency[];
  changelog?: string;
  title?: string;
  authors?: string;
}

export interface AddonFundingLink {
  platform: string;
  url: string;
}

export interface AddonSearchResult {
  author: string;
  downloadCount?: number;
  externalId: string;
  externalUrl: string;
  files?: AddonSearchResultFile[];
  name: string;
  providerName: string;
  screenshotUrls?: string[];
  summary?: string;
  thumbnailUrl: string;
  releasedAt?: Date;
  fundingLinks?: AddonFundingLink[];
  changelog?: string;
  externallyBlocked?: boolean;
}

export interface AddonExternalId {
  providerName: string;
  id: string;
}

export interface AddonDependency {
  externalAddonId: string;
  type: AddonDependencyType;
}

export interface Addon {
  id?: string;
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
  gameVersion?: string[];
  author?: string;
  installedFolders?: string;
  installedFolderList?: string[];
  isIgnored: boolean;
  isLoadOnDemand: boolean;
  warningType?: AddonWarningType;
  autoUpdateEnabled: boolean;
  autoUpdateNotificationsEnabled: boolean;
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
  installationId?: string;
}

export interface ProtocolSearchResult extends AddonSearchResult {
  protocol: string;
  protocolAddonId?: string;
  protocolReleaseId?: string;
  validClientTypes?: WowClientType[];
  validClientGroups?: WowClientGroup[];
}

export interface AddonScanResult {
  source: AddonScanType;
  fileCount: number;
  fileFingerprints?: string[];
  fingerprint: string;
  fingerprintNum: number;
  folderName: string;
  path?: string;
}

export interface AddonFolder {
  name: string;
  path: string;
  status: string;
  ignoreReason?: AddonIgnoreReason;
  thumbnailUrl?: string;
  latestVersion?: string;
  tocs: Toc[];
  matchingAddon?: Addon;
  fileStats?: FsStats;
  cfScanResults?: AddonScanResult;
  wowUpScanResults?: AddonScanResult;
}
