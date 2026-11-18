import { IPC_ADDON_INSTALL, IPC_ADDON_INSTALL_PROGRESS, IPC_ADDON_REMOVE } from "../../src/common/constants";
import { AddonInstallProgress, InstallAddonRequest, RemoveAddonRequest } from "../../src/common/models/addon-install";
import { AddonInstallService } from "../services/addons/addon-install.service";
import { AddonInstaller } from "../services/addons/addon-installer";
import { ipcHandle, IpcController } from "./ipc-controller";

export class AddonInstallController implements IpcController {
  public constructor(
    private readonly _installer: AddonInstaller,
    private readonly _installService: AddonInstallService,
  ) {}

  public register(): void {
    ipcHandle(IPC_ADDON_INSTALL, (evt, request: InstallAddonRequest) =>
      this._installer.installAddon(request, (phase) => {
        // The window can close mid-install; the install still finishes, there's just no one to tell
        if (evt.sender.isDestroyed()) {
          return;
        }
        const progress: AddonInstallProgress = { addonId: request.addon.id, phase };
        evt.sender.send(IPC_ADDON_INSTALL_PROGRESS, progress);
      }),
    );
    ipcHandle(IPC_ADDON_REMOVE, (_evt, request: RemoveAddonRequest) => this._installService.removeAddon(request));
  }
}
