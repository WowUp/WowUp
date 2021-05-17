import { AddonChannelType } from "../../../common/wowup/models";
import { AddonSearchResultDependency } from "./addon-search-result-dependency";

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
