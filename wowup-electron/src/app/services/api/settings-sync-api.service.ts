import { Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";

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
} from "../../../common/constants";
import { SettingsSyncResult, SettingsSyncStatus } from "../../../common/models/settings-sync";
import { ElectronService } from "../electron/electron.service";

/** Thin wrapper over the settings sync controller in main; no logic lives here */
@Injectable({
  providedIn: "root",
})
export class SettingsSyncApiService {
  private readonly _autoSyncResultsSrc = new Subject<SettingsSyncResult[]>();

  /** Results of syncs main ran on its own: at start and when the game closed */
  public readonly autoSyncResults$: Observable<SettingsSyncResult[]> = this._autoSyncResultsSrc.asObservable();

  public constructor(private readonly _electronService: ElectronService) {
    this._electronService.on(IPC_SETTINGS_SYNC_EVENT, (_evt, results: SettingsSyncResult[]) =>
      this._autoSyncResultsSrc.next(results),
    );
  }

  public getStatus(): Promise<SettingsSyncStatus> {
    return this._electronService.invoke(IPC_SETTINGS_SYNC_GET_STATUS);
  }

  public createCode(): Promise<string> {
    return this._electronService.invoke(IPC_SETTINGS_SYNC_CREATE_CODE);
  }

  public setCode(code: string): Promise<string> {
    return this._electronService.invoke(IPC_SETTINGS_SYNC_SET_CODE, code);
  }

  public getCode(): Promise<string | undefined> {
    return this._electronService.invoke(IPC_SETTINGS_SYNC_GET_CODE);
  }

  public clear(): Promise<void> {
    return this._electronService.invoke(IPC_SETTINGS_SYNC_CLEAR);
  }

  public setFolder(folderPath: string): Promise<void> {
    return this._electronService.invoke(IPC_SETTINGS_SYNC_SET_FOLDER, folderPath);
  }

  public setInstallations(installationIds: string[]): Promise<void> {
    return this._electronService.invoke(IPC_SETTINGS_SYNC_SET_INSTALLATIONS, installationIds);
  }

  public setAutoSync(enabled: boolean): Promise<void> {
    return this._electronService.invoke(IPC_SETTINGS_SYNC_SET_AUTO, enabled);
  }

  public sync(installationId: string): Promise<SettingsSyncResult> {
    return this._electronService.invoke(IPC_SETTINGS_SYNC_RUN, installationId);
  }
}
