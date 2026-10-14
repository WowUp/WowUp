import { Injectable } from "@angular/core";

import {
  IPC_WARCRAFT_INSTALLATIONS_ADD,
  IPC_WARCRAFT_INSTALLATIONS_GET_ALL,
  IPC_WARCRAFT_INSTALLATIONS_REMOVE,
  IPC_WARCRAFT_INSTALLATIONS_REORDER,
  IPC_WARCRAFT_INSTALLATIONS_SET_ALL,
  IPC_WARCRAFT_INSTALLATIONS_SET_SELECTED,
  IPC_WARCRAFT_INSTALLATIONS_UPDATE,
} from "../../../common/constants";
import { WowInstallation } from "wowup-lib-core";

import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class WarcraftInstallationApiService {
  public constructor(private readonly _electronService: ElectronService) {}

  public getAll(): Promise<WowInstallation[]> {
    return this._electronService.invoke(IPC_WARCRAFT_INSTALLATIONS_GET_ALL);
  }

  public setAll(installations: WowInstallation[]): Promise<WowInstallation[]> {
    return this._electronService.invoke(IPC_WARCRAFT_INSTALLATIONS_SET_ALL, installations);
  }

  public add(installation: WowInstallation): Promise<WowInstallation[]> {
    return this._electronService.invoke(IPC_WARCRAFT_INSTALLATIONS_ADD, installation);
  }

  public remove(installationId: string): Promise<WowInstallation[]> {
    return this._electronService.invoke(IPC_WARCRAFT_INSTALLATIONS_REMOVE, installationId);
  }

  public update(installation: WowInstallation): Promise<WowInstallation[]> {
    return this._electronService.invoke(IPC_WARCRAFT_INSTALLATIONS_UPDATE, installation);
  }

  public reorder(installationId: string, direction: number): Promise<WowInstallation[]> {
    return this._electronService.invoke(IPC_WARCRAFT_INSTALLATIONS_REORDER, installationId, direction);
  }

  public setSelected(installationId: string): Promise<WowInstallation[]> {
    return this._electronService.invoke(IPC_WARCRAFT_INSTALLATIONS_SET_SELECTED, installationId);
  }
}
