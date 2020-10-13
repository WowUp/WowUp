import { WowUpAddonReleaseRepresentation } from "./wowup-addon-release.representation";

export interface WowUpAddonRepresentation {
  id: number;
  repository: string;
  repository_name: string;
  external_id: string;
  source: string;
  patreon_funding_link?: string;
  github_funding_link?: string;
  custom_funding_link?: string;
  owner_name?: string;
  owner_image_url?: string;
  image_url?: string;
  description?: string;
  homepage?: string;
  current_release?: WowUpAddonReleaseRepresentation;
  matched_release?: WowUpAddonReleaseRepresentation;
  releases?: WowUpAddonReleaseRepresentation[];
}
