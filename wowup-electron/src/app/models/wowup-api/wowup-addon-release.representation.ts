import { WowGameType } from "./wow-game-type";
import { WowUpAddonReleaseFolderRepresentation } from "./wowup-addon-release-folder.representation";

export interface WowUpAddonReleaseRepresentation {
  id: number;
  url: string;
  name: string;
  tagName: string;
  external_id: string;
  prerelease: boolean;
  body: string;
  game_version: string;
  download_url: string;
  published_at: Date;
  addonFolders?: WowUpAddonReleaseFolderRepresentation[];
  game_type: WowGameType;
}
