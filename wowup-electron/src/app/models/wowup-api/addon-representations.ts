import { WowGameType } from "./wow-game-type";

export interface WowUpAddonFundingLinkRepresentation {
  platform: string;
  url: string;
}

export interface WowUpAddonReleaseFolderRepresentation {
  id: number;
  folder_name: string;
  fingerprint: string;
  game_version: string;
  addon_title: string;
  addon_authors: string;
  load_on_demand: boolean;
  version: string;
}

export interface WowUpAddonReleaseRepresentation {
  id: number;
  url: string;
  name: string;
  tag_name: string;
  external_id: string;
  prerelease: boolean;
  body: string;
  game_version: string;
  download_url: string;
  published_at: Date;
  addonFolders?: WowUpAddonReleaseFolderRepresentation[];
  game_type: WowGameType;
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
