import { Injectable } from "@angular/core";
import { WowClientType } from "wowup-lib-core";

import * as tocModels from "wowup-lib-core";
import { getTocForGameType2 } from "../../../common/addons/addon-rules";
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

  /** Pure, shared with main: see src/common/addons/addon-rules.ts */
  public getTocForGameType2(
    folderName: string,
    tocs: tocModels.Toc[],
    clientType: WowClientType,
  ): tocModels.Toc | undefined {
    return getTocForGameType2(folderName, tocs, clientType);
  }
}
