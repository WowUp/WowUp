import { Injectable } from "@angular/core";
import { ElectronService } from "..";
import { Addon } from "../../entities/addon";
import { AddonService } from "../addons/addon.service";
import { FileService } from "../files/file.service";
import { AddonInstallState } from "../../models/wowup/addon-install-state";

class WowUpAddonVersion {
  public name: string;
  public currentVersion: string;
  public newVersion: string;
}

class WowUpAddonData {
  public updatesAvailable: WowUpAddonVersion[];
  public generatedAt: string;
  public interfaceVersion: string;
  public wowUpAddonName: string;
  public wowUpAddonVersion: string;
}

enum WowUpAddonFileType {
  Raw,
  HandlebarsTemplate,
}

class WowUpAddonFileProcessing {
  public type: WowUpAddonFileType;
  public filename: string;
}

@Injectable({
  providedIn: "root",
})
export class WowUpAddonService {
  readonly files: WowUpAddonFileProcessing[] = [{
    filename: 'data.lua',
    type: WowUpAddonFileType.HandlebarsTemplate,
  }, {
    filename: 'wowup_data_addon.toc',
    type: WowUpAddonFileType.HandlebarsTemplate,
  }, {
    filename: 'ldbicon.tga',
    type: WowUpAddonFileType.Raw,
  }];
  private compiledFiles = {};

  constructor(
    private _electronService: ElectronService,
    private _addonService: AddonService,
    private _fileService: FileService,
  ) {
    _addonService.addonInstalled$.subscribe(async (event) => {
      if (event.installState !== AddonInstallState.Complete) {
        return;
      }

      const addons = this._addonService.getAllAddons(event.addon.clientType);
      await this.persistUpdateInformationToWowUpAddon(addons);
    })
  }

  public async persistUpdateInformationToWowUpAddon(addons: Addon[]) {
    const wowUpAddon = addons.find((addon: Addon) => addon.name === "Addon Update Notifications (by WowUp)");
    if (!wowUpAddon) {
      return;
    }

    console.log('Found the WowUp addon notification addon, trying to sync updates available to wowup_data_addon');
    try {
      const availableUpdates = addons.filter(
        (addon: Addon) => !addon.isIgnored && !addon.autoUpdateEnabled && addon.latestVersion !== addon.installedVersion
      ).map((addon: Addon) => ({
        name: addon.name,
        currentVersion: addon.installedVersion,
        newVersion: addon.latestVersion,
      } as WowUpAddonVersion));

      const wowUpAddonData: WowUpAddonData = {
        updatesAvailable: availableUpdates,
        generatedAt: new Date().toString(),
        interfaceVersion: wowUpAddon.gameVersion,
        wowUpAddonName: wowUpAddon.installedFolders,
        wowUpAddonVersion: wowUpAddon.installedVersion,
      };

      const dataAddonPath = await this._addonService.getFullInstallPath(wowUpAddon) + "/../wowup_data_addon/";
      await this._fileService.createDirectory(dataAddonPath);

      for (let file of this.files) {
        let designatedPath = dataAddonPath + "/" + file.filename;
        switch (file.type) {
          case WowUpAddonFileType.HandlebarsTemplate:
            let templatePath = await this._fileService.getAssetFilePath("WowUpAddon/" + file.filename + ".hbs");
            let templateContents = await this._fileService.readFile(templatePath);

            if (!this.compiledFiles[file.filename]) {
              this.compiledFiles[file.filename] = window.libs.handlebars.compile(templateContents);
            }

            await this._fileService.writeFile(designatedPath, this.compiledFiles[file.filename](wowUpAddonData));
            break;
          case WowUpAddonFileType.Raw:
            let filePath = await this._fileService.getAssetFilePath("WowUpAddon/" + file.filename);
            await this._fileService.copy(filePath, designatedPath);
            break;
        }
      }

      console.log('Available update data synced to wowup_data_addon/{data.lua,wowup_data_addon.toc}');
    } catch (e) {
      console.log(e);
    }
  }
}
