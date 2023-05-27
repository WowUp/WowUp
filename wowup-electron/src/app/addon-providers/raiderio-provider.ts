import * as _ from "lodash";
import { v4 as uuidv4 } from "uuid";

import { ADDON_PROVIDER_RAIDERIO } from "../../common/constants";
import { getGameVersion } from "../utils/addon.utils";
import { TocService } from "../services/toc/toc.service";
import { AddonChannelType, AddonFolder, AddonProvider } from "wowup-lib-core";
import { getEnumName } from "wowup-lib-core/lib/utils";
import { WowInstallation } from "wowup-lib-core/lib/models";

export class RaiderIoAddonProvider extends AddonProvider {
  private readonly _scanWebsite = "https://raider.io";
  private readonly _scanAddonProvider = "raiderio-client";
  private readonly _scanFolderName = "RaiderIO";

  public readonly name = ADDON_PROVIDER_RAIDERIO;
  public readonly forceIgnore = true;
  public readonly allowReinstall = false;
  public readonly allowChannelChange = false;
  public readonly allowEdit = false;
  public enabled = true;

  public constructor(private _tocService: TocService) {
    super();
  }

  public scan(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {
    console.debug("RAIDER IO CLIENT SCAN");
    const raiderIo = _.find(addonFolders, (addonFolder) => this.isRaiderIo(addonFolder));
    if (!raiderIo) {
      return Promise.resolve(undefined);
    }

    const targetToc = this._tocService.getTocForGameType2(raiderIo.name, raiderIo.tocs, installation.clientType);
    const dependencies = _.filter(addonFolders, (addonFolder) => this.isRaiderIoDependant(addonFolder));
    console.debug("RAIDER IO CLIENT FOUND", dependencies);

    const rioAddonFolders = [raiderIo, ...dependencies];
    const installedFolderList = rioAddonFolders.map((addonFolder) => addonFolder.name);
    const installedFolders = installedFolderList.join(",");

    for (const rioAddonFolder of rioAddonFolders) {
      const subTargetToc = this._tocService.getTocForGameType2(rioAddonFolder.name, rioAddonFolder.tocs, installation.clientType);

      rioAddonFolder.matchingAddon = {
        autoUpdateEnabled: false,
        autoUpdateNotificationsEnabled: false,
        channelType: AddonChannelType.Stable,
        clientType: installation.clientType,
        id: uuidv4(),
        isIgnored: true,
        name: targetToc.title ?? "unknown",
        author: subTargetToc.author,
        downloadUrl: "",
        externalId: this.name,
        externalUrl: this._scanWebsite,
        gameVersion: getGameVersion(subTargetToc.interface),
        installedAt: new Date(),
        installedFolders: installedFolders,
        installedFolderList: installedFolderList,
        installedVersion: subTargetToc.version || targetToc.version,
        latestVersion: subTargetToc.version,
        providerName: this.name,
        thumbnailUrl: "http://cdnassets.raider.io/images/fb_app_image.jpg?2019-11-18",
        updatedAt: new Date(),
        summary: subTargetToc.notes,
        downloadCount: 0,
        screenshotUrls: [],
        releasedAt: new Date(),
        isLoadOnDemand: subTargetToc.loadOnDemand === "1",
        externalChannel: getEnumName(AddonChannelType, AddonChannelType.Stable),
        installationId: installation.id,
      };
    }

    return Promise.resolve(undefined);
  }

  private isRaiderIo(addonFolder: AddonFolder) {
    return (
      addonFolder.name === this._scanFolderName &&
      addonFolder.tocs.some((toc) => toc.website === this._scanWebsite && toc.addonProvider === this._scanAddonProvider)
    );
  }

  private isRaiderIoDependant(addonFolder: AddonFolder) {
    return addonFolder.tocs.some(
      (toc) => toc.dependencies !== undefined && toc.dependencies.indexOf(this._scanFolderName) !== -1
    );
  }
}
