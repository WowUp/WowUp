import { BrowserWindow } from "electron";

import {
  IPC_SETTINGS_SYNC_CLEAR,
  IPC_SETTINGS_SYNC_CREATE_CODE,
  IPC_SETTINGS_SYNC_EVENT,
  IPC_SETTINGS_SYNC_GET_CODE,
  IPC_SETTINGS_SYNC_GET_STATUS,
  IPC_SETTINGS_SYNC_RUN,
  IPC_SETTINGS_SYNC_SET_AUTO,
  IPC_SETTINGS_SYNC_SET_CODE,
  IPC_SETTINGS_SYNC_SET_FOLDER,
  IPC_SETTINGS_SYNC_SET_INSTALLATIONS,
} from "../../../src/common/constants";
import { SettingsSyncService } from "../../services/sync/settings-sync.service";
import { ipcHandle, IpcController } from "../ipc-controller";

export class SettingsSyncController implements IpcController {
  private stopAutoSync?: () => void;

  public constructor(
    private readonly window: BrowserWindow,
    private readonly syncService: SettingsSyncService,
  ) {}

  public register(): void {
    ipcHandle(IPC_SETTINGS_SYNC_GET_STATUS, () => this.syncService.getStatus());
    ipcHandle(IPC_SETTINGS_SYNC_CREATE_CODE, () => this.syncService.createCode());
    ipcHandle(IPC_SETTINGS_SYNC_SET_CODE, (_evt, code: string) => this.syncService.setCode(code));
    ipcHandle(IPC_SETTINGS_SYNC_GET_CODE, () => this.syncService.getCode());
    ipcHandle(IPC_SETTINGS_SYNC_CLEAR, () => this.syncService.clear());
    ipcHandle(IPC_SETTINGS_SYNC_SET_FOLDER, (_evt, folderPath: string) => this.syncService.setFolder(folderPath));
    ipcHandle(IPC_SETTINGS_SYNC_SET_INSTALLATIONS, (_evt, ids: string[]) => this.syncService.setInstallations(ids));
    ipcHandle(IPC_SETTINGS_SYNC_SET_AUTO, (_evt, enabled: boolean) => this.syncService.setAutoSync(enabled));
    ipcHandle(IPC_SETTINGS_SYNC_RUN, (_evt, installationId: string) => this.syncService.sync(installationId));

    this.stopAutoSync = this.syncService.startAutoSync((results) => {
      if (!this.window.isDestroyed()) {
        this.window.webContents.send(IPC_SETTINGS_SYNC_EVENT, results);
      }
    });
  }

  public dispose(): void {
    this.stopAutoSync?.();
  }
}
