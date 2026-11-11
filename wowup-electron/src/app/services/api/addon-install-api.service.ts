import { Injectable } from "@angular/core";
import { IpcRendererEvent } from "electron";

import {
  IPC_ADDON_ADD_EXTERNAL_ID,
  IPC_ADDON_INSTALL_FILE,
  IPC_ADDON_INSTALL_PROGRESS,
  IPC_ADDON_REMOVE,
} from "../../../common/constants";
import { AddonExternalId } from "wowup-lib-core";

import {
  AddExternalIdRequest,
  AddonInstallPhase,
  AddonInstallProgress,
  InstallAddonFileRequest,
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

  /** Install a downloaded zip, reporting each phase main reaches for this addon */
  public async installFile(
    request: InstallAddonFileRequest,
    onPhase: (phase: AddonInstallPhase) => void,
  ): Promise<InstalledAddonFile> {
    const listener = (_evt: IpcRendererEvent, progress: AddonInstallProgress) => {
      if (progress.addonId === request.addon.id) {
        onPhase(progress.phase);
      }
    };

    this._electronService.on(IPC_ADDON_INSTALL_PROGRESS, listener);
    try {
      return await this._electronService.invoke(IPC_ADDON_INSTALL_FILE, request);
    } finally {
      this._electronService.off(IPC_ADDON_INSTALL_PROGRESS, listener);
    }
  }

  /** Add one provider id to a saved addon; undefined when the addon isn't saved */
  public addExternalId(request: AddExternalIdRequest): Promise<AddonExternalId[] | undefined> {
    return this._electronService.invoke(IPC_ADDON_ADD_EXTERNAL_ID, request);
  }

  /** Delete an addon's folders and forget it, plus its dependencies when asked */
  public removeAddon(request: RemoveAddonRequest): Promise<RemovedAddons> {
    return this._electronService.invoke(IPC_ADDON_REMOVE, request);
  }
}
