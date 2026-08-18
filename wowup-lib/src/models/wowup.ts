import { WowGameType } from '../types';

export interface WowUpAddonFundingLinkRepresentation {
  platform: string;
  url: string;
}

export interface WowUpAddonReleaseFolderRepresentation {
  id: number;
  folder_name: string;
  fingerprint: string;
}

export interface WowUpAddonReleaseRepresentation {
  id: number;
  url: string;
  name: string;
  tag_name: string;
  external_id: string;
  prerelease: boolean;
  body: string;
  game_versions: AddonReleaseGameVersion[];
  toc_title?: string;
  download_url: string;
  published_at: Date;
  addonFolders?: WowUpAddonReleaseFolderRepresentation[];
  previews?: AddonPreviewRepresentation[];
}

export interface AddonReleaseGameVersion {
  interface: string;
  title: string;
  game_type: WowGameType;
  version: string;
  authors: string;
}

export interface AddonPreviewRepresentation {
  url: string;
  preview_type: string;
}

export interface WowUpAddonRepresentation {
  id: number;
  repository: string;
  repository_name: string;
  source: string;
  owner_name?: string;
  owner_image_url?: string;
  image_url?: string;
  description?: string;
  homepage?: string;
  total_download_count: number;
  current_release?: WowUpAddonReleaseRepresentation;
  matched_release?: WowUpAddonReleaseRepresentation;
  releases?: WowUpAddonReleaseRepresentation[];
  funding_links?: WowUpAddonFundingLinkRepresentation[];
}

export interface WowUpGetAddonResponse {
  addon: WowUpAddonRepresentation;
}

export interface WowUpGetAddonReleaseResponse {
  release: WowUpAddonReleaseRepresentation;
}

export interface WowUpGetAddonResponse {
  addon: WowUpAddonRepresentation;
}

export interface WowUpGetAddonsResponse {
  addons: WowUpAddonRepresentation[];
  count: number;
}

export interface GetFeaturedAddonsResponse {
  addons: WowUpAddonRepresentation[];
  recent: WowUpAddonRepresentation[];
  count: number;
  recentCount: number;
}

export interface WowUpSearchAddonsResponse {
  addons: WowUpAddonRepresentation[];
  count: number;
}

export interface GetAddonsByFingerprintResponse {
  exactMatches: WowUpAddonRepresentation[];
}

export interface WowUpGetAccountResponse {
  displayName: string;
  patreonTier: string;
  config: WowUpAccountConfig;
}

export interface WowUpAccountConfig {
  pushAppId: string;
  pushChannels: {
    addonUpdates: string;
    alerts: string;
  };
}

export interface CurseAuthorBlockRepresentation {
  authorId: string;
}

export interface CurseBlocksRepresentation {
  authors: CurseAuthorBlockRepresentation[];
}

export interface BlockListRepresentation {
  curse: CurseBlocksRepresentation;
}
