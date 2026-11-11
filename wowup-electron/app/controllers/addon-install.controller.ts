import {
  IPC_ADDON_ADD_EXTERNAL_ID,
  IPC_ADDON_INSTALL_FILE,
  IPC_ADDON_INSTALL_PROGRESS,
  IPC_ADDON_REMOVE,
} from "../../src/common/constants";
import {
  AddExternalIdRequest,
  AddonInstallProgress,
  InstallAddonFileRequest,
  RemoveAddonRequest,
} from "../../src/common/models/addon-install";
import { AddonInstallService } from "../services/addons/addon-install.service";
import { ipcHandle, IpcController } from "./ipc-controller";

export class AddonInstallController implements IpcController {
  public constructor(private readonly _installService: AddonInstallService) {}

  public register(): void {
    ipcHandle(IPC_ADDON_INSTALL_FILE, (evt, request: InstallAddonFileRequest) =>
      this._installService.installFile(request, (phase) => {
        // The window can close mid-install; the install still finishes, there's just no one to tell
        if (evt.sender.isDestroyed()) {
          return;
        }
        const progress: AddonInstallProgress = { addonId: request.addon.id, phase };
        evt.sender.send(IPC_ADDON_INSTALL_PROGRESS, progress);
      }),
    );
    ipcHandle(IPC_ADDON_ADD_EXTERNAL_ID, (_evt, request: AddExternalIdRequest) =>
      this._installService.addExternalId(request),
    );
    ipcHandle(IPC_ADDON_REMOVE, (_evt, request: RemoveAddonRequest) => this._installService.removeAddon(request));
  }
}
