import { Addon } from "app/entities/addon";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { AddonChannelType } from "app/models/wowup/addon-channel-type";
import { AddonDisplayState } from "../models/wowup/addon-display-state";

export class MyAddonsListItem implements Addon {
    id: string;
    name: string;
    folderName: string;
    downloadUrl?: string;
    installedVersion?: string;
    latestVersion?: string;
    installedAt?: Date;
    externalId?: string;
    providerName?: string;
    externalUrl?: string;
    thumbnailUrl?: string;
    gameVersion?: string;
    author?: string;
    installedFolders?: string;
    isIgnored: boolean;
    autoUpdateEnabled: boolean;
    clientType: WowClientType;
    channelType: AddonChannelType;
    updatedAt?: Date;

    get displayState(): AddonDisplayState {
        if (this.isIgnored) {
            return AddonDisplayState.Ignored;
        }

        if (!this.installedVersion) {
            return AddonDisplayState.Install;
        }

        if (this.installedVersion != this.latestVersion) {
            return AddonDisplayState.Update;
        }

        if (this.installedVersion === this.latestVersion) {
            return AddonDisplayState.UpToDate;
        }

        return AddonDisplayState.Unknown;
    }

    constructor(addon?: Addon) {
        if (addon) {
            Object.assign(this, addon);
        }
    }
}