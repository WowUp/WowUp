import { WowClientType } from "../warcraft/wow-client-type";
import { AddonChannelType } from "../wowup/addon-channel-type";

export interface ScanRequest {
  clientType: WowClientType;
  channelType: AddonChannelType;
  folderName: string;
  tocMetaData: string[];
}
