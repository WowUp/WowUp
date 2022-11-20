export enum WowGameType {
  Retail = "retail",
  Classic = "classic",
  BurningCrusade = "burningCrusade",
  WOTLK = "wotlk",
}

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
