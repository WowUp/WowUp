import * as path from "path";
import { filter } from "rxjs/operators";

import { Injectable } from "@angular/core";

import {
  WOWUP_ADDON_FOLDER_NAME,
  WOWUP_ASSET_FOLDER_NAME,
  WOWUP_DATA_ADDON_FOLDER_NAME,
} from "../../../common/constants";
import { Addon } from "../../../common/entities/addon";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { WowInstallation } from "../../models/wowup/wow-installation";
import { toInterfaceVersion } from "../../utils/addon.utils";
import { AddonService } from "../addons/addon.service";
import { FileService } from "../files/file.service";
import { WarcraftInstallationService } from "../warcraft/warcraft-installation.service";
import { WarcraftService } from "../warcraft/warcraft.service";
import { AddonProviderFactory } from "../addons/addon.provider.factory";
import { AddonChannelType } from "common/wowup/models";

enum WowUpAddonFileType {
  Raw,
  HandlebarsTemplate,
}

interface WowUpAddonVersion {
  name: string;
  currentVersion: string;
  newVersion: string;
}

interface WowUpAddonData {
  updatesAvailable: WowUpAddonVersion[];
  generatedAt: string;
  interfaceVersion: string;
  wowUpAddonName: string;
  wowUpAddonVersion: string;
}

interface WowUpAddonFileProcessing {
  type: WowUpAddonFileType;
  filename: string;
}

@Injectable({
  providedIn: "root",
})
export class WowUpAddonService {
  public readonly files: WowUpAddonFileProcessing[] = [
    {
      filename: "data.lua",
      type: WowUpAddonFileType.HandlebarsTemplate,
    },
    {
      filename: "wowup_data_addon.toc",
      type: WowUpAddonFileType.HandlebarsTemplate,
    },
    {
      filename: "ldbicon.tga",
      type: WowUpAddonFileType.Raw,
    },
  ];
  private compiledFiles = {};

  public constructor(
    private _addonService: AddonService,
    private _addonProviderFactory: AddonProviderFactory,
    private _fileService: FileService,
    private _warcraftInstallationService: WarcraftInstallationService,
    private _warcraftService: WarcraftService
  ) {
    _addonService.addonInstalled$
      .pipe(filter((update) => update.installState === AddonInstallState.Complete))
      .subscribe((update) => {
        const installation = this._warcraftInstallationService.getWowInstallation(update.addon.installationId);
        this.updateForInstallation(installation).catch((e) => console.error(e));
      });

    _addonService.addonRemoved$.subscribe((addon) => {
      this.updateForAllClientTypes().catch((e) => console.error(e));
    });
  }

  public async updateForAllClientTypes(): Promise<void> {
    const installations = this._warcraftInstallationService.getWowInstallations();

    for (const installation of installations) {
      try {
        await this.updateForInstallation(installation);
      } catch (e) {
        console.error(e);
      }
    }
  }

  public async updateForInstallation(installation: WowInstallation): Promise<void> {
    const addons = this._addonService.getAllAddons(installation);
    if (addons.length === 0) {
      console.log(`WowUpAddonService: No addons to sync ${installation.label}`);
      return;
    }

    await this.persistUpdateInformationToWowUpAddon(installation, addons);
    await this.syncCompanionAddon(addons, installation);
  }

  private async syncCompanionAddon(addons: Addon[], installation: WowInstallation): Promise<void> {
    const companionAddon = this.getCompanionAddon(addons);
    const addonFolderPath = this._warcraftService.getAddonFolderPath(installation);
    const addonFolder = await this._warcraftService.getAddonFolder(addonFolderPath, WOWUP_DATA_ADDON_FOLDER_NAME);
    const provider = this._addonProviderFactory.createWowUpCompanionAddonProvider();
    await provider.scan(installation, AddonChannelType.Stable, [addonFolder]);

    console.debug("addonFolder", addonFolder);

    if (companionAddon) {
      delete addonFolder.matchingAddon.id;
      const updatedCompanion: Addon = { ...companionAddon, ...addonFolder.matchingAddon };
      this._addonService.saveAddon(updatedCompanion);
    } else {
      this._addonService.saveAddon(addonFolder.matchingAddon);
    }
  }

  private async persistUpdateInformationToWowUpAddon(installation: WowInstallation, addons: Addon[]) {
    const wowUpAddon = this.findAddonByFolderName(addons, WOWUP_ADDON_FOLDER_NAME);
    if (!wowUpAddon) {
      console.debug("WowUp Addon not found");
      return;
    }

    console.log("Found the WowUp addon notification addon, trying to sync updates available to wowup_data_addon");
    try {
      const availableUpdates = addons.filter(this.canUpdateAddon).map(this.getAddonVersion);

      const wowUpAddonData: WowUpAddonData = {
        updatesAvailable: availableUpdates,
        generatedAt: new Date().toString(),
        interfaceVersion: toInterfaceVersion(wowUpAddon.gameVersion),
        wowUpAddonName: wowUpAddon.installedFolders,
        wowUpAddonVersion: wowUpAddon.installedVersion,
      };

      const dataAddonPath = path.join(
        this._warcraftService.getAddonFolderPath(installation),
        WOWUP_DATA_ADDON_FOLDER_NAME
      );

      const pathExists = await this._fileService.pathExists(dataAddonPath);
      if (!pathExists) {
        await this._fileService.createDirectory(dataAddonPath);
      }

      for (const file of this.files) {
        const designatedPath = path.join(dataAddonPath, file.filename);
        switch (file.type) {
          case WowUpAddonFileType.HandlebarsTemplate:
            await this.handleHandlebarsTemplateFileType(file, designatedPath, wowUpAddonData);
            break;
          case WowUpAddonFileType.Raw:
            await this.handleRawFileType(file, designatedPath);
            break;
          default:
            break;
        }
      }

      console.log("Available update data synced to wowup_data_addon/{data.lua,wowup_data_addon.toc}");
    } catch (e) {
      console.error(e);
    }
  }

  private getAddonVersion = (addon: Addon): WowUpAddonVersion => {
    return {
      name: addon.name,
      currentVersion: addon.installedVersion,
      newVersion: addon.latestVersion,
    };
  };

  private canUpdateAddon = (addon: Addon) => {
    return !addon.isIgnored && !addon.autoUpdateEnabled && addon.latestVersion !== addon.installedVersion;
  };

  private async handleHandlebarsTemplateFileType(
    file: WowUpAddonFileProcessing,
    designatedPath: string,
    wowUpAddonData: WowUpAddonData
  ) {
    const assetPath = path.join(WOWUP_ASSET_FOLDER_NAME, `${file.filename}.hbs`);
    const templatePath = await this._fileService.getAssetFilePath(assetPath);
    const templateContents = await this._fileService.readFile(templatePath);

    if (!this.compiledFiles[file.filename]) {
      this.compiledFiles[file.filename] = window.libs.handlebars.compile(templateContents);
    }

    await this._fileService.writeFile(designatedPath, this.compiledFiles[file.filename](wowUpAddonData));
  }

  private async handleRawFileType(file: WowUpAddonFileProcessing, designatedPath: string) {
    const assetPath = path.join(WOWUP_ASSET_FOLDER_NAME, file.filename);
    const filePath = await this._fileService.getAssetFilePath(assetPath);
    await this._fileService.copy(filePath, designatedPath);
  }

  private getCompanionAddon(addons: Addon[]): Addon | undefined {
    return this.findAddonByFolderName(addons, WOWUP_DATA_ADDON_FOLDER_NAME);
  }

  private findAddonByFolderName(addons: Addon[], folderName: string): Addon | undefined {
    return addons.find(
      (addon: Addon) => Array.isArray(addon.installedFolderList) && addon.installedFolderList.includes(folderName)
    );
  }
}
