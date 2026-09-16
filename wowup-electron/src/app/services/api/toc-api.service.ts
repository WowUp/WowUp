import { Injectable } from "@angular/core";

import { IPC_TOC_GET_ALL_TOCS, IPC_TOC_PARSE } from "../../../common/constants";
import { Toc, WowClientType } from "wowup-lib-core";

import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class TocApiService {
  public constructor(private readonly _electronService: ElectronService) {}

  public parse(tocPath: string): Promise<Toc> {
    return this._electronService.invoke(IPC_TOC_PARSE, tocPath);
  }

  public getAllTocs(baseDir: string, installedFolders: string[], clientType: WowClientType): Promise<Toc[]> {
    return this._electronService.invoke(IPC_TOC_GET_ALL_TOCS, baseDir, installedFolders, clientType);
  }
}
