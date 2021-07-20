import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { AddonChannelType } from "../../../common/wowup/models";

export interface WowInstallation {
  id: string;
  clientType: WowClientType;
  location: string;
  label: string;
  selected: boolean;
  defaultAddonChannelType: AddonChannelType;
  defaultAutoUpdate: boolean;
  defaultTrackAddons: boolean;
}
