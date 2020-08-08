import { AddonChannelType } from "./addon-channel-type";

export interface AddonSearchResultFile {
    channelType: AddonChannelType;
    version: string;
    folders: string[];
    gameVersion: string;
    downloadUrl: string;
}