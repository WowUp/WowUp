import { AddonChannelType } from "./addon-channel-type";
import { AddonSearchResultDependency } from "./addon-search-result-dependency";

export interface AddonSearchResultFile {
  channelType: AddonChannelType;
  version: string;
  folders: string[];
  gameVersion: string;
  downloadUrl: string;
  releaseDate: Date;
  dependencies?: AddonSearchResultDependency[];
}
