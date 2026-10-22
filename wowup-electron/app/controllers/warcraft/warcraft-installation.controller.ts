import { WowInstallation } from "wowup-lib-core";

import {
  IPC_WARCRAFT_INSTALLATIONS_ADD,
  IPC_WARCRAFT_INSTALLATIONS_GET_ALL,
  IPC_WARCRAFT_INSTALLATIONS_REMOVE,
  IPC_WARCRAFT_INSTALLATIONS_REORDER,
  IPC_WARCRAFT_INSTALLATIONS_SET_ALL,
  IPC_WARCRAFT_INSTALLATIONS_SET_SELECTED,
  IPC_WARCRAFT_INSTALLATIONS_UPDATE,
} from "../../../src/common/constants";
import { WarcraftInstallationService } from "../../services/warcraft/warcraft-installation.service";
import { ipcHandle, IpcController } from "../ipc-controller";

export class WarcraftInstallationController implements IpcController {
  public constructor(private readonly installationService: WarcraftInstallationService) {}

  public register(): void {
    ipcHandle(IPC_WARCRAFT_INSTALLATIONS_GET_ALL, () => this.installationService.getAll());
    ipcHandle(IPC_WARCRAFT_INSTALLATIONS_SET_ALL, (_evt, installations: WowInstallation[]) =>
      this.installationService.setAll(installations),
    );
    ipcHandle(IPC_WARCRAFT_INSTALLATIONS_ADD, (_evt, installation: WowInstallation) =>
      this.installationService.add(installation),
    );
    ipcHandle(IPC_WARCRAFT_INSTALLATIONS_REMOVE, (_evt, installationId: string) =>
      this.installationService.remove(installationId),
    );
    ipcHandle(IPC_WARCRAFT_INSTALLATIONS_UPDATE, (_evt, installation: WowInstallation) =>
      this.installationService.update(installation),
    );
    ipcHandle(IPC_WARCRAFT_INSTALLATIONS_REORDER, (_evt, installationId: string, direction: number) =>
      this.installationService.reorder(installationId, direction),
    );
    ipcHandle(IPC_WARCRAFT_INSTALLATIONS_SET_SELECTED, (_evt, installationId: string) =>
      this.installationService.setSelected(installationId),
    );
  }
}
