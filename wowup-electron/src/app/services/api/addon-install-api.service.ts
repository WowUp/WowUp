import { Injectable } from "@angular/core";
import { IpcRendererEvent } from "electron";

import { IPC_ADDON_INSTALL, IPC_ADDON_INSTALL_PROGRESS, IPC_ADDON_REMOVE } from "../../../common/constants";
import {
  AddonInstallPhase,
  AddonInstallProgress,
  InstallAddonRequest,
  InstalledAddonFile,
  RemoveAddonRequest,
  RemovedAddons,
} from "../../../common/models/addon-install";

import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class AddonInstallApiService {
  public constructor(private readonly _electronService: ElectronService) {}

  /** Download and install an addon, reporting each phase main reaches for it */
  public async install(
    request: InstallAddonRequest,
    onPhase: (phase: AddonInstallPhase) => void,
  ): Promise<InstalledAddonFile> {
    const listener = (_evt: IpcRendererEvent, progress: AddonInstallProgress) => {
      if (progress.addonId === request.addon.id) {
        onPhase(progress.phase);
      }
    };

    this._electronService.on(IPC_ADDON_INSTALL_PROGRESS, listener);
    try {
      return await this._electronService.invoke(IPC_ADDON_INSTALL, request);
    } finally {
      this._electronService.off(IPC_ADDON_INSTALL_PROGRESS, listener);
    }
  }

  /** Delete an addon's folders and forget it, plus its dependencies when asked */
  public removeAddon(request: RemoveAddonRequest): Promise<RemovedAddons> {
    return this._electronService.invoke(IPC_ADDON_REMOVE, request);
  }
}
