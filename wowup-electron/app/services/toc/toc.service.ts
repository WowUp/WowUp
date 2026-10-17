import * as fsp from "fs/promises";
import * as path from "path";
import { uniq } from "lodash";

import * as tocModels from "wowup-lib-core";
import { AddonFolder, WowClientType, getTocForGameType2 } from "wowup-lib-core";

export class TocService {
  public async parse(tocPath: string): Promise<tocModels.Toc> {
    const fileName = path.basename(tocPath);
    let tocText = await fsp.readFile(tocPath, "utf8");
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

      const tocFileNames = await this.listTocFileNames(dirPath);
      const allTocs = await Promise.all(
        tocFileNames.map((tf) => {
          const tocPath = path.join(dirPath, tf);
          return this.parse(tocPath);
        }),
      );

      const addonFolder: AddonFolder = { name: dir, path: dirPath, status: "Pending", tocs: allTocs };
      const tf = getTocForGameType2(addonFolder, clientType);
      if (tf !== undefined) {
        tocs.push(tf);
      }
    }

    return tocs;
  }

  private async listTocFileNames(dirPath: string): Promise<string[]> {
    try {
      const entries = await fsp.readdir(dirPath, { withFileTypes: true });
      return entries.filter((entry) => path.extname(entry.name).toLowerCase() === ".toc").map((entry) => entry.name);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw e;
    }
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

  private stripColorCode(str: string): string {
    if (str.indexOf("|c") === -1) {
      return str;
    }

    const regex = /(\|c[a-z0-9]{8})|(\|r)/gi;

    return str.replace(regex, "").trim();
  }

  private stripTextureCode(str: string): string {
    if (str.indexOf("|T") === -1) {
      return str;
    }

    const regex = /(\|T.*\|t)/g;

    return str.replace(regex, "").trim();
  }

  private stripNewLineChars(value: string) {
    return value.replace(/\|r/g, "");
  }
}
