import { Injectable } from "@angular/core";
import * as path from "path";
import { WowClientType, getTocForGameType } from "wowup-lib-core";

import * as tocModels from "wowup-lib-core";
import { removeExtension } from "../../utils/string.utils";
import { FileService } from "../files/file.service";
import { uniq } from "lodash";

@Injectable({
  providedIn: "root",
})
export class TocService {
  public constructor(private _fileService: FileService) {}

  public async parse(tocPath: string): Promise<tocModels.Toc> {
    const fileName = path.basename(tocPath);
    let tocText = await this._fileService.readFile(tocPath);
    tocText = tocText.trim();

    const dependencies =
      this.getValue(tocModels.TOC_DEPENDENCIES, tocText) || this.getValue(tocModels.TOC_REQUIRED_DEPS, tocText);

    const dependencyList: string[] = this.getDependencyList(tocText);

    return {
      fileName,
      filePath: tocPath,
      author: this.getValue(tocModels.TOC_AUTHOR, tocText),
      curseProjectId: this.getValue(tocModels.TOC_X_CURSE_PROJECT_ID, tocText),
      interface: this.getValueArray(tocModels.TOC_INTERFACE, tocText),
      title: this.getValue(tocModels.TOC_TITLE, tocText),
      website: this.getWebsite(tocText),
      version: this.getValue(tocModels.TOC_VERSION, tocText),
      partOf: this.getValue(tocModels.TOC_X_PART_OF, tocText),
      category: this.getValue(tocModels.TOC_X_CATEGORY, tocText),
      localizations: this.getValue(tocModels.TOC_X_LOCALIZATIONS, tocText),
      wowInterfaceId: this.getValue(tocModels.TOC_X_WOWI_ID, tocText),
      wagoAddonId: this.getValue(tocModels.TOC_X_WAGO_ID, tocText),
      dependencies,
      dependencyList,
      tukUiProjectId: this.getValue(tocModels.TOC_X_TUKUI_PROJECTID, tocText),
      tukUiProjectFolders: this.getValue(tocModels.TOC_X_TUKUI_PROJECTFOLDERS, tocText),
      loadOnDemand: this.getValue(tocModels.TOC_X_LOADONDEMAND, tocText),
      addonProvider: this.getValue(tocModels.TOC_X_ADDON_PROVIDER, tocText),
      notes: this.getValue(tocModels.TOC_NOTES, tocText),
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
  public async getAllTocs(
    baseDir: string,
    installedFolders: string[],
    clientType: WowClientType,
  ): Promise<tocModels.Toc[]> {
    const tocs: tocModels.Toc[] = [];

    for (const dir of installedFolders) {
      const dirPath = path.join(baseDir, dir);

      const tocFiles = await this._fileService.listFiles(dirPath, "*.toc");
      const allTocs = await Promise.all(
        tocFiles.map((tf) => {
          const tocPath = path.join(dirPath, tf);
          return this.parse(tocPath);
        }),
      );

      const tf = this.getTocForGameType2(dir, allTocs, clientType);
      if (tf !== undefined) {
        tocs.push(tf);
      }
    }

    return tocs;
  }

  public getTocForGameType2(
    folderName: string,
    tocs: tocModels.Toc[],
    clientType: WowClientType,
  ): tocModels.Toc | undefined {
    let matchedToc = "";

    const tocFileNames = tocs.map((toc) => toc.fileName);
    matchedToc = getTocForGameType(tocFileNames, clientType);

    // If we still have no match, we need to return the toc that matches the folder name if it exists
    // Example: All the things for TBC (ATT-Classic)
    if (matchedToc === "") {
      return tocs.find((toc) => removeExtension(toc.fileName).toLowerCase() === folderName.toLowerCase());
    }

    return tocs.find((toc) => toc.fileName === matchedToc);
  }

  private getWebsite(tocText: string) {
    return this.getValue(tocModels.TOC_WEBSITE, tocText) || this.getValue(tocModels.TOC_X_WEBSITE, tocText);
  }

  private getDependencyList(tocText: string) {
    const dependencies = this.getValue(tocModels.TOC_DEPENDENCIES, tocText);
    const requiredDeps = this.getValue(tocModels.TOC_REQUIRED_DEPS, tocText);

    const deps = [...dependencies.split(","), ...requiredDeps.split(",")].filter((dep) => !!dep);

    return deps;
  }

  public async parseMetaData(tocPath: string): Promise<string[]> {
    const tocText = await this._fileService.readFile(tocPath);

    return tocText.split("\n").filter((line) => line.trim().startsWith("## "));
  }

  private getValueArray(key: string, tocText: string): string[] {
    const value = this.getValue(key, tocText);
    return uniq(value.split(",").map((x) => x.trim()));
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
