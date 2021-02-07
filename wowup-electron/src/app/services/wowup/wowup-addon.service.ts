import * as path from "path";
import { filter } from "rxjs/operators";

import { Injectable } from "@angular/core";

import { Addon } from "../../entities/addon";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { getEnumName } from "../../utils/enum.utils";
import { AddonService } from "../addons/addon.service";
import { FileService } from "../files/file.service";
import { WarcraftService } from "../warcraft/warcraft.service";

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

const WOWUP_DATA_ADDON_FOLDER_NAME = "wowup_data_addon";
const WOWUP_ASSET_FOLDER_NAME = "WowUpAddon";
const WOWUP_ADODN_FOLDER_NAME = "WowUp";

@Injectable({
  providedIn: "root",
})
export class WowUpAddonService {
  readonly files: WowUpAddonFileProcessing[] = [
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

  constructor(
    private _addonService: AddonService,
    private _fileService: FileService,
    private _warcraftService: WarcraftService
  ) {
    _addonService.addonInstalled$
      .pipe(filter((update) => update.installState === AddonInstallState.Complete))
      .subscribe((update) => {
        console.debug("addonInstalled");
        this.updateForClientType(update.addon.clientType).catch((e) => console.error(e));
      });

    _addonService.addonRemoved$.subscribe((addon) => {
      console.debug("addonRemoved", addon);
      this.updateForAllClientTypes().catch((e) => console.error(e));
    });
  }

  public async updateForAllClientTypes(): Promise<void> {
    const availableClients = await this._warcraftService.getWowClientTypes();

    for (const clientType of availableClients) {
      try {
        await this.updateForClientType(clientType);
      } catch (e) {
        console.error(e);
      }
    }
  }

  public async updateForClientType(clientType: WowClientType): Promise<void> {
    const addons = this._addonService.getAllAddons(clientType);
    if (addons.length === 0) {
      console.log(`WowUpAddonService: No addons to sync ${getEnumName(WowClientType, clientType)}`);
      return;
    }

    await this.persistUpdateInformationToWowUpAddon(clientType, addons);
  }

  private async persistUpdateInformationToWowUpAddon(clientType: WowClientType, addons: Addon[]) {
    const wowUpAddon = addons.find((addon: Addon) => addon.installedFolderList.includes(WOWUP_ADODN_FOLDER_NAME));
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
        interfaceVersion: wowUpAddon.gameVersion,
        wowUpAddonName: wowUpAddon.installedFolders,
        wowUpAddonVersion: wowUpAddon.installedVersion,
      };

      const dataAddonPath = path.join(
        this._warcraftService.getAddonFolderPath(clientType),
        WOWUP_DATA_ADDON_FOLDER_NAME
      );

      await this._fileService.createDirectory(dataAddonPath);

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
      console.log(e);
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
}
