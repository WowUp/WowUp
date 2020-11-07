import { Injectable } from "@angular/core";
import { ElectronService } from "..";
import { Addon } from "../../entities/addon";
import { AddonService } from "../addons/addon.service";
import { FileService } from "../files/file.service";
const Handlebars = require("handlebars");

class WowUpAddonData {
  public updatesAvailableCount: number;
  public generatedAt: string;
}

@Injectable({
  providedIn: "root",
})
export class WowUpAddonService {
  private compiledTemplate;

  constructor(
    private _electronService: ElectronService,
    private _addonService: AddonService,
    private _fileService: FileService
  ) {}

  public async persistUpdateInformationToWowUpAddon(addons: Addon[]) {
    const wowupAddon = addons.find((addon: Addon) => addon.name === "WowUp.Addon");
    if (!wowupAddon) {
      return;
    }

    try {
      const templatePath = await this._fileService.getAssetFilePath("WowUpAddon/data.lua.hbs");
      const templateContents = await this._fileService.readFile(templatePath);
      const dataFile = this._addonService.getFullInstallPath(wowupAddon) + "/data.lua";

      const wowUpAddonData: WowUpAddonData = {
        updatesAvailableCount: addons.filter(
          (addon: Addon) => !addon.isIgnored && addon.latestVersion !== addon.installedVersion
        ).length,
        generatedAt: new Date().toString(),
      };

      if (!this.compiledTemplate) {
        this.compiledTemplate = Handlebars.compile(templateContents);
      }

      await this._fileService.writeFile(dataFile, this.compiledTemplate(wowUpAddonData));
    } catch (e) {
      console.log(e);
    }
  }
}
