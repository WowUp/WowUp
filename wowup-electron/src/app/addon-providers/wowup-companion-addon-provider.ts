import { WowInstallation } from "../models/wowup/wow-installation";
import * as _ from "lodash";
import { v4 as uuidv4 } from "uuid";

import { ADDON_PROVIDER_WOWUP_COMPANION, WOWUP_DATA_ADDON_FOLDER_NAME } from "../../common/constants";
import { AddonChannelType } from "../../common/wowup/models";
import { AddonFolder } from "../models/wowup/addon-folder";
import { getEnumName } from "../utils/enum.utils";
import { AddonProvider } from "./addon-provider";
import { getGameVersion } from "../utils/addon.utils";

export const X_WOWUP_ADDON_PROVIDER = "wowup-app";
export const X_WEBSITE = "https://wowup.io";

export class WowUpCompanionAddonProvider extends AddonProvider {
  public readonly name = ADDON_PROVIDER_WOWUP_COMPANION;
  public readonly forceIgnore = true;
  public readonly allowReinstall = false;
  public readonly allowChannelChange = false;
  public readonly allowEdit = false;
  public enabled = true;

  public constructor() {
    super();
  }

  public scan(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {
    console.debug("WowUp Companion provider scan");
    const companion = _.find(addonFolders, (addonFolder) => this.isWowUpCompanion(addonFolder));
    if (!companion) {
      return;
    }

    companion.matchingAddon = {
      autoUpdateEnabled: false,
      channelType: AddonChannelType.Stable,
      clientType: installation.clientType,
      id: uuidv4(),
      isIgnored: true,
      name: companion.toc.title,
      author: companion.toc.author,
      downloadUrl: "",
      externalId: this.name,
      externalUrl: X_WEBSITE,
      gameVersion: getGameVersion(companion.toc.interface),
      installedAt: new Date(),
      installedFolders: companion.name,
      installedFolderList: [companion.name],
      installedVersion: companion.toc.version,
      latestVersion: companion.toc.version,
      providerName: this.name,
      thumbnailUrl: "https://avatars.githubusercontent.com/u/74023737?s=400&v=4",
      updatedAt: new Date(),
      summary: companion.toc.notes,
      downloadCount: 0,
      screenshotUrls: [],
      releasedAt: new Date(),
      isLoadOnDemand: companion.toc.loadOnDemand === "1",
      externalChannel: getEnumName(AddonChannelType, AddonChannelType.Stable),
      installationId: installation.id,
    };

    return Promise.resolve(undefined);
  }

  private isWowUpCompanion(addonFolder: AddonFolder) {
    return (
      addonFolder.name === WOWUP_DATA_ADDON_FOLDER_NAME &&
      addonFolder.toc?.website === X_WEBSITE &&
      addonFolder.toc?.addonProvider === X_WOWUP_ADDON_PROVIDER
    );
  }
}
