import { Injectable } from "@angular/core";
import * as path from "path";

import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { AddonFolder } from "../../models/wowup/addon-folder";
import { Toc } from "../../models/wowup/toc";
import { removeExtension } from "../../utils/string.utils";
import { FileService } from "../files/file.service";

const TOC_AUTHOR = "Author";
const TOC_DEPENDENCIES = "Dependencies";
const TOC_INTERFACE = "Interface";
const TOC_NOTES = "Notes";
const TOC_REQUIRED_DEPS = "RequiredDeps";
const TOC_TITLE = "Title";
const TOC_VERSION = "Version";
const TOC_WEBSITE = "Website";
const TOC_X_ADDON_PROVIDER = "X-AddonProvider"; // Raider.IO
const TOC_X_CATEGORY = "X-Category";
const TOC_X_CURSE_PROJECT_ID = "X-Curse-Project-ID"; // CurseForge
const TOC_X_LOADONDEMAND = "LoadOnDemand";
const TOC_X_LOCALIZATIONS = "X-Localizations";
const TOC_X_PART_OF = "X-Part-Of";
const TOC_X_TUKUI_PROJECTID = "X-Tukui-ProjectID"; // WowInterface
const TOC_X_TUKUI_PROJECTFOLDERS = "X-Tukui-ProjectFolders"; // WowInterface
const TOC_X_WEBSITE = "X-Website";
const TOC_X_WOWI_ID = "X-WoWI-ID"; // WowInterface
const TOC_X_WAGO_ID = "X-Wago-ID"; // WowInterface

@Injectable({
  providedIn: "root",
})
export class TocService {
  public constructor(private _fileService: FileService) {}

  public async parse(tocPath: string): Promise<Toc> {
    const fileName = path.basename(tocPath);
    let tocText = await this._fileService.readFile(tocPath);
    tocText = tocText.trim();

    const dependencies = this.getValue(TOC_DEPENDENCIES, tocText) || this.getValue(TOC_REQUIRED_DEPS, tocText);

    const dependencyList: string[] = this.getDependencyList(tocText);

    return {
      fileName,
      filePath: tocPath,
      author: this.getValue(TOC_AUTHOR, tocText),
      curseProjectId: this.getValue(TOC_X_CURSE_PROJECT_ID, tocText),
      interface: this.getValue(TOC_INTERFACE, tocText),
      title: this.getValue(TOC_TITLE, tocText),
      website: this.getWebsite(tocText),
      version: this.getValue(TOC_VERSION, tocText),
      partOf: this.getValue(TOC_X_PART_OF, tocText),
      category: this.getValue(TOC_X_CATEGORY, tocText),
      localizations: this.getValue(TOC_X_LOCALIZATIONS, tocText),
      wowInterfaceId: this.getValue(TOC_X_WOWI_ID, tocText),
      wagoAddonId: this.getValue(TOC_X_WAGO_ID, tocText),
      dependencies,
      dependencyList,
      tukUiProjectId: this.getValue(TOC_X_TUKUI_PROJECTID, tocText),
      tukUiProjectFolders: this.getValue(TOC_X_TUKUI_PROJECTFOLDERS, tocText),
      loadOnDemand: this.getValue(TOC_X_LOADONDEMAND, tocText),
      addonProvider: this.getValue(TOC_X_ADDON_PROVIDER, tocText),
      notes: this.getValue(TOC_NOTES, tocText),
    };
  }

  public stripColorCode(str: string): string {
    if (str.indexOf("|c") === -1) {
      return str;
    }

    const regex = /(\|c[a-z0-9]{8})|(\|r)/gi;

    return str.replace(regex, "").trim();
  }

  public stripTextureCode(str: string): string {
    if (str.indexOf("|T") === -1) {
      return str;
    }

    const regex = /(\|T.*\|t)/g;

    return str.replace(regex, "").trim();
  }

  /**
   * Return all valid tocs from a given base directory combined with the installation folders for the given client type
   */
  public async getAllTocs(baseDir: string, installedFolders: string[], clientType: WowClientType): Promise<Toc[]> {
    const tocs: Toc[] = [];

    for (const dir of installedFolders) {
      const dirPath = path.join(baseDir, dir);

      const tocFiles = await this._fileService.listFiles(dirPath, "*.toc");
      const tocFile = this.getTocForGameType(tocFiles, clientType);
      if (!tocFile) {
        continue;
      }

      const tocPath = path.join(dirPath, tocFile);

      const toc = await this.parse(tocPath);
      if (toc.interface) {
        tocs.push(toc);
      }
    }

    return tocs;
  }

  /**
   * Given a list of toc file names, select the one that goes with the given client type
   * Use a similar priority switch as the actual wow client, if a targeted one exists use that, if not check for a base toc and try that
   */
  public getTocForGameType(tocFileNames: string[], clientType: WowClientType): string {
    let matchedToc = "";

    switch (clientType) {
      case WowClientType.Beta:
      case WowClientType.Retail:
      case WowClientType.RetailPtr:
        matchedToc = tocFileNames.find((tfn) => /.*[-|_]mainline\.toc$/gi.test(tfn)) || "";
        break;
      case WowClientType.ClassicEra:
      case WowClientType.ClassicEraPtr:
        matchedToc = tocFileNames.find((tfn) => /.*[-|_](classic|vanilla)\.toc$/gi.test(tfn)) || "";
        break;
      case WowClientType.Classic:
      case WowClientType.ClassicBeta:
      case WowClientType.ClassicPtr:
        matchedToc = tocFileNames.find((tfn) => /.*[-|_](bcc|tbc)\.toc$/gi.test(tfn)) || "";
        break;
      default:
        break;
    }

    return (
      matchedToc || tocFileNames.find((tfn) => /.*(?<![-|_](classic|vanilla|bcc|tbc|mainline))\.toc$/gi.test(tfn)) || ""
    );
  }

  public getTocForGameType2(addonFolder: AddonFolder, clientType: WowClientType): Toc {
    let matchedToc = "";

    const tocs = addonFolder.tocs;
    const tocFileNames = tocs.map((toc) => toc.fileName);
    matchedToc = this.getTocForGameType(tocFileNames, clientType);

    // If we still have no match, we need to return the toc that matches the folder name if it exists
    // Example: All the things for TBC (ATT-Classic)
    if (matchedToc === "") {
      return tocs.find((toc) => removeExtension(toc.fileName).toLowerCase() === addonFolder.name.toLowerCase());
    }

    return tocs.find((toc) => toc.fileName === matchedToc);
  }

  private getWebsite(tocText: string) {
    return this.getValue(TOC_WEBSITE, tocText) || this.getValue(TOC_X_WEBSITE, tocText);
  }

  private getDependencyList(tocText: string) {
    const dependencies = this.getValue(TOC_DEPENDENCIES, tocText);
    const requiredDeps = this.getValue(TOC_REQUIRED_DEPS, tocText);

    const deps = [...dependencies.split(","), ...requiredDeps.split(",")].filter((dep) => !!dep);

    return deps;
  }

  public async parseMetaData(tocPath: string): Promise<string[]> {
    const tocText = await this._fileService.readFile(tocPath);

    return tocText.split("\n").filter((line) => line.trim().startsWith("## "));
  }

  private getValue(key: string, tocText: string): string {
    const match = new RegExp(`^## ${key}:(.*?)$`, "m").exec(tocText);

    if (!match || match.length !== 2) {
      return "";
    }

    return this.stripEncodedChars(match[1].trim());
  }

  private stripEncodedChars(value: string) {
    let str = this.stripColorCode(value);
    str = this.stripTextureCode(str);
    str = this.stripNewLineChars(str);

    return str;
  }

  private stripNewLineChars(value: string) {
    return value.replace(/\|r/g, "");
  }
}
