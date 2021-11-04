import { WowClientType } from "./wow-client-type";
import { AddonChannelType } from "../wowup/models";

export interface WowInstallation {
  id: string;
  clientType: WowClientType;
  location: string;
  label: string;
  selected: boolean;
  defaultAddonChannelType: AddonChannelType;
  defaultAutoUpdate: boolean;
  availableUpdateCount?: number;
}
