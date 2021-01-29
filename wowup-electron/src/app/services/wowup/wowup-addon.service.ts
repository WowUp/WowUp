import { Injectable } from "@angular/core";
import { ElectronService } from "..";
import { Addon } from "../../entities/addon";
import { AddonService } from "../addons/addon.service";
import { FileService } from "../files/file.service";

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

@Injectable({
  providedIn: "root",
})
export class WowUpAddonService {
  readonly filenames = [
    'data.lua',
    'wowup_data_addon.toc',
  ];
  private compiledFiles = {};

  constructor(
    private _electronService: ElectronService,
    private _addonService: AddonService,
    private _fileService: FileService
  ) {}

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

      for (let filename of this.filenames) {
        let templatePath = await this._fileService.getAssetFilePath("WowUpAddon/" + filename + ".hbs");
        let templateContents = await this._fileService.readFile(templatePath);

        if (!this.compiledFiles[filename]) {
          this.compiledFiles[filename] = window.libs.handlebars.compile(templateContents);
        }

        await this._fileService.writeFile(dataAddonPath + "/" + filename, this.compiledFiles[filename](wowUpAddonData));
      }

      console.log('Available update data synced to wowup_data_addon/{data.lua,wowup_data_addon.toc}');
    } catch (e) {
      console.log(e);
    }
  }
}
