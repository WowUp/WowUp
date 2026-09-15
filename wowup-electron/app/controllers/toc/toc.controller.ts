import { ipcMain } from "electron";

import { WowClientType } from "wowup-lib-core";

import { IPC_TOC_GET_ALL_TOCS, IPC_TOC_PARSE } from "../../../src/common/constants";
import { TocService } from "../../services/toc/toc.service";
import { IpcController } from "../ipc-controller";

export class TocController implements IpcController {
  public constructor(private readonly tocService: TocService) {}

  public register(): void {
    ipcMain.handle(IPC_TOC_PARSE, (_evt, tocPath: string) => this.tocService.parse(tocPath));
    ipcMain.handle(
      IPC_TOC_GET_ALL_TOCS,
      (_evt, baseDir: string, installedFolders: string[], clientType: WowClientType) =>
        this.tocService.getAllTocs(baseDir, installedFolders, clientType),
    );
  }
}
