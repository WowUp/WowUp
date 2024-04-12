import * as _ from "lodash";
import { v4 as uuidv4 } from "uuid";

import { ADDON_PROVIDER_WOWUP_COMPANION, WOWUP_DATA_ADDON_FOLDER_NAME } from "../../common/constants";
import { FileService } from "../services/files/file.service";
import { TocService } from "../services/toc/toc.service";
import { getGameVersion } from "../utils/addon.utils";
import { getEnumName } from "wowup-lib-core";
import { AddonChannelType, AddonFolder, AddonProvider } from "wowup-lib-core";
import { WowInstallation } from "wowup-lib-core";

export const X_WOWUP_ADDON_PROVIDER = "wowup-app";
export const X_WEBSITE = "https://wowup.io";

export class WowUpCompanionAddonProvider extends AddonProvider {
  public readonly name = ADDON_PROVIDER_WOWUP_COMPANION;
  public readonly forceIgnore = true;
  public readonly allowReinstall = false;
  public readonly allowChannelChange = false;
  public readonly allowEdit = false;
  public enabled = true;

  public constructor(private _fileService: FileService, private _tocService: TocService) {
    super();
  }

  public async scan(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {
    const companion = _.find(addonFolders, (addonFolder) => this.isWowUpCompanion(addonFolder));
    if (!companion) {
      return;
    }

    const targetToc = this._tocService.getTocForGameType2(companion.name, companion.tocs, installation.clientType);
    if (targetToc === undefined) {
      throw new Error("target toc was not found");
    }

    const lastUpdatedAt = await this._fileService.getLatestDirUpdateTime(companion.path);

    companion.matchingAddon = {
      autoUpdateEnabled: false,
      autoUpdateNotificationsEnabled: false,
      channelType: AddonChannelType.Stable,
      clientType: installation.clientType,
      id: uuidv4(),
      isIgnored: true,
      name: targetToc.title ?? "unknown",
      author: targetToc.author ?? "unknown",
      downloadUrl: "",
      externalId: this.name,
      externalUrl: X_WEBSITE,
      gameVersion: getGameVersion(targetToc.interface),
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
