import { Addon } from "app/entities/addon";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { AddonChannelType } from "app/models/wowup/addon-channel-type";
import { AddonDisplayState } from "../models/wowup/addon-display-state";

export class MyAddonsListItem {
    addon: Addon;

    isInstalling: boolean = false;
    installProgress: number = 0;
    statusText: string = '';
    selected: boolean = false;

    get needsInstall() {
        return !this.isInstalling && this.displayState === AddonDisplayState.Install;
    }

    get needsUpdate() {
        return !this.isInstalling && this.displayState === AddonDisplayState.Update;
    }

    get isUpToDate() {
        return !this.isInstalling && this.displayState === AddonDisplayState.UpToDate;
    }

    get isIgnored() {
        return this.displayState === AddonDisplayState.Ignored;
    }

    get isStableChannel() {
        return this.addon.channelType === AddonChannelType.Stable;
    }

    get isBetaChannel() {
        return this.addon.channelType === AddonChannelType.Beta;
    }

    get isAlphaChannel() {
        return this.addon.channelType === AddonChannelType.Alpha;
    }

    get displayState(): AddonDisplayState {
        if (this.addon.isIgnored) {
            return AddonDisplayState.Ignored;
        }

        if (!this.addon.installedVersion) {
            return AddonDisplayState.Install;
        }

        if (this.addon.installedVersion != this.addon.latestVersion) {
            return AddonDisplayState.Update;
        }

        if (this.addon.installedVersion === this.addon.latestVersion) {
            return AddonDisplayState.UpToDate;
        }

        return AddonDisplayState.Unknown;
    }

    constructor(addon?: Addon) {
        this.addon = addon;
        this.statusText = this.getStateText();
    }

    public onClicked() {
        console.log(this.addon.name);
        this.selected = !this.selected;
    }

    public getStateText() {
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