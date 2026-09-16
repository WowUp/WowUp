import { Injectable } from "@angular/core";
import { WowClientType, getTocForGameType } from "wowup-lib-core";

import * as tocModels from "wowup-lib-core";
import { removeExtension } from "../../utils/string.utils";
import { TocApiService } from "../api/toc-api.service";

@Injectable({
  providedIn: "root",
})
export class TocService {
  public constructor(private _tocApiService: TocApiService) {}

  public parse(tocPath: string): Promise<tocModels.Toc> {
    return this._tocApiService.parse(tocPath);
  }

  /**
   * Return all valid tocs from a given base directory combined with the installation folders for the given client type
   */
  public getAllTocs(baseDir: string, installedFolders: string[], clientType: WowClientType): Promise<tocModels.Toc[]> {
    return this._tocApiService.getAllTocs(baseDir, installedFolders, clientType);
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
}
