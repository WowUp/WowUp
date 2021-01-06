import { Injectable } from "@angular/core";
import { Toc } from "../../models/wowup/toc";
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

@Injectable({
  providedIn: "root",
})
export class TocService {
  constructor(private _fileService: FileService) {}

  public async parse(tocPath: string): Promise<Toc> {
    let tocText = await this._fileService.readFile(tocPath);
    tocText = tocText.trim();

    const dependencies = this.getValue(TOC_DEPENDENCIES, tocText) || this.getValue(TOC_REQUIRED_DEPS, tocText);

    const dependencyList: string[] = this.getDependencyList(tocText);

    return {
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
      dependencies,
      dependencyList,
      tukUiProjectId: this.getValue(TOC_X_TUKUI_PROJECTID, tocText),
      tukUiProjectFolders: this.getValue(TOC_X_TUKUI_PROJECTFOLDERS, tocText),
      loadOnDemand: this.getValue(TOC_X_LOADONDEMAND, tocText),
      addonProvider: this.getValue(TOC_X_ADDON_PROVIDER, tocText),
      notes: this.getValue(TOC_NOTES, tocText),
    };
  }

  private getWebsite(tocText: string) {
    return this.getValue(TOC_WEBSITE, tocText) || this.getValue(TOC_X_WEBSITE, tocText);
  }

  private getDependencyList(tocText: string) {
    const dependencies = this.getValue(TOC_DEPENDENCIES, tocText);
    const requiredDeps = this.getValue(TOC_REQUIRED_DEPS, tocText);

    const deps = [].concat(...dependencies.split(","), ...requiredDeps.split(",")).filter((dep) => !!dep);

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
    let str = this.stripColorChars(value);
    str = this.stripNewLineChars(str);

    return str;
  }

  private stripColorChars(value: string) {
    return value.replace(/\|[a-zA-Z0-9]{9}/g, "");
  }

  private stripNewLineChars(value: string) {
    return value.replace(/\|r/g, "");
  }
}
