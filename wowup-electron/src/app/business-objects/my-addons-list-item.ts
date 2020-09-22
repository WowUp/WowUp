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

    isInstalling: boolean = false;
    installProgress: number = 0;
    statusText: string = '';

    get needsInstall() {
        return !this.isInstalling && this.displayState === AddonDisplayState.Install;
    }

    get needsUpdate() {
        return !this.isInstalling && this.displayState === AddonDisplayState.Update;
    }

    get isUpToDate() {
        return !this.isInstalling && this.displayState === AddonDisplayState.UpToDate;
    }

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
            return AddonDisplayState.Update;
            return AddonDisplayState.UpToDate;
        }

        return AddonDisplayState.Unknown;
    }

    constructor(addon?: Addon) {
        if (addon) {
            Object.assign(this, addon);
            this.statusText = this.getStateText();
        }
    }

    private getStateText() {
        switch (this.displayState) {
            case AddonDisplayState.UpToDate:
                return "Up to Date";
            case AddonDisplayState.Ignored:
                return "Ignored";
            case AddonDisplayState.Update:
            case AddonDisplayState.Install:
            case AddonDisplayState.Unknown:
            default:
                return '';
        }
    }
}