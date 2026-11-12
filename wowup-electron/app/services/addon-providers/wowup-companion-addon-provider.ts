import * as _ from "lodash";
import {
  AddonChannelType,
  AddonFolder,
  AddonProvider,
  getEnumName,
  getGameVersionList,
  WowInstallation,
} from "wowup-lib-core";

import { ADDON_PROVIDER_WOWUP_COMPANION, WOWUP_DATA_ADDON_FOLDER_NAME } from "../../../src/common/constants";
import { getTocForGameType2 } from "../../../src/common/addons/addon-rules";

export const X_WOWUP_ADDON_PROVIDER = "wowup-app";
export const X_WEBSITE = "https://wowup.io";

export interface WowUpCompanionDeps {
  /** Newest modified time of any file under the folder, in ms */
  getLatestDirUpdateTime: (dirPath: string) => Promise<number>;
  newId: () => string;
}

/** Recognises the data addon WowUp writes for its in-game companion, so a scan doesn't list it as unknown */
export class WowUpCompanionAddonProvider extends AddonProvider {
  public readonly name = ADDON_PROVIDER_WOWUP_COMPANION;
  public readonly forceIgnore = true;
  public readonly allowReinstall = false;
  public readonly allowChannelChange = false;
  public readonly allowEdit = false;
  public enabled = true;

  public constructor(private readonly _deps: WowUpCompanionDeps) {
    super();
  }

  public async scan(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[],
  ): Promise<void> {
    const companion = _.find(addonFolders, (addonFolder) => this.isWowUpCompanion(addonFolder));
    if (!companion) {
      return;
    }

    const targetToc = getTocForGameType2(companion.name, companion.tocs, installation.clientType);
    if (targetToc === undefined) {
      throw new Error("target toc was not found");
    }

    const lastUpdatedAt = await this._deps.getLatestDirUpdateTime(companion.path);

    companion.matchingAddon = {
      autoUpdateEnabled: false,
      autoUpdateNotificationsEnabled: false,
      channelType: AddonChannelType.Stable,
      clientType: installation.clientType,
      id: this._deps.newId(),
      isIgnored: true,
      name: targetToc.title ?? "unknown",
      author: targetToc.author ?? "unknown",
      downloadUrl: "",
      externalId: this.name,
      externalUrl: X_WEBSITE,
      gameVersion: getGameVersionList(targetToc.interface),
      installedAt: new Date(lastUpdatedAt),
      installedFolders: companion.name,
      installedFolderList: [companion.name],
      installedVersion: targetToc.version,
      latestVersion: targetToc.version,
      providerName: this.name,
      thumbnailUrl: "https://avatars.githubusercontent.com/u/74023737?s=400&v=4",
      updatedAt: new Date(lastUpdatedAt),
      summary: targetToc.notes,
      downloadCount: 0,
      screenshotUrls: [],
      releasedAt: new Date(lastUpdatedAt),
      isLoadOnDemand: targetToc.loadOnDemand === "1",
      externalChannel: getEnumName(AddonChannelType, AddonChannelType.Stable),
      installationId: installation.id,
    };
  }

  private isWowUpCompanion(addonFolder: AddonFolder) {
    return (
      addonFolder.name === WOWUP_DATA_ADDON_FOLDER_NAME &&
      addonFolder.tocs?.some((toc) => toc.website === X_WEBSITE) &&
      addonFolder.tocs?.some((toc) => toc.addonProvider === X_WOWUP_ADDON_PROVIDER)
    );
  }
}
