import { Addon } from "wowup-lib-core";

import {
  IPC_ADDONS_GET_ALL,
  IPC_ADDONS_GET_ALL_FOR_INSTALLATION,
  IPC_ADDONS_GET_ALL_FOR_PROVIDER,
  IPC_ADDONS_GET_AUTO_UPDATE_ENABLED,
  IPC_ADDONS_GET_AVAILABLE_FOR_UPDATE,
  IPC_ADDONS_GET_BY_EXTERNAL_ID,
  IPC_ADDONS_GET_BY_EXTERNAL_IDS,
  IPC_ADDONS_REPLACE_ALL_FOR_INSTALLATION,
  IPC_ADDONS_SAVE_ALL,
} from "../../src/common/constants";
import { AddonRepository } from "../services/addons/addon-repository";
import { ipcHandle, IpcController } from "./ipc-controller";

export class AddonController implements IpcController {
  public constructor(private readonly repository: AddonRepository) {}

  public register(): void {
    ipcHandle(IPC_ADDONS_SAVE_ALL, (_evt, addons: Addon[]) => this.repository.saveAll(addons));
    ipcHandle(IPC_ADDONS_REPLACE_ALL_FOR_INSTALLATION, (_evt, installationId: string, addons: Addon[]) =>
      this.repository.replaceAllForInstallation(installationId, addons),
    );
    ipcHandle(IPC_ADDONS_GET_ALL, () => this.repository.getAll());
    ipcHandle(IPC_ADDONS_GET_ALL_FOR_INSTALLATION, (_evt, installationId: string) =>
      this.repository.getAllForInstallation(installationId),
    );
    ipcHandle(IPC_ADDONS_GET_ALL_FOR_PROVIDER, (_evt, providerName: string) =>
      this.repository.getAllForProvider(providerName),
    );
    ipcHandle(IPC_ADDONS_GET_BY_EXTERNAL_ID, (_evt, externalId: string, providerName: string, installationId: string) =>
      this.repository.getByExternalId(externalId, providerName, installationId),
    );
    ipcHandle(IPC_ADDONS_GET_BY_EXTERNAL_IDS, (_evt, externalIds: string[]) =>
      this.repository.getByExternalIds(externalIds),
    );
    ipcHandle(IPC_ADDONS_GET_AVAILABLE_FOR_UPDATE, (_evt, installationId?: string) =>
      this.repository.getAvailableForUpdate(installationId),
    );
    ipcHandle(IPC_ADDONS_GET_AUTO_UPDATE_ENABLED, () => this.repository.getAutoUpdateEnabled());
  }
}
