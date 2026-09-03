import { ipcMain } from "electron";
import * as Store from "electron-store";

import { WowInstallation } from "wowup-lib-core";

import {
  IPC_WARCRAFT_INSTALLATIONS_ADD,
  IPC_WARCRAFT_INSTALLATIONS_GET_ALL,
  IPC_WARCRAFT_INSTALLATIONS_REMOVE,
  IPC_WARCRAFT_INSTALLATIONS_REORDER,
  IPC_WARCRAFT_INSTALLATIONS_SET_ALL,
  IPC_WARCRAFT_INSTALLATIONS_SET_SELECTED,
  IPC_WARCRAFT_INSTALLATIONS_UPDATE,
  WOW_INSTALLATIONS_KEY,
} from "../../../src/common/constants";
import { IpcController } from "../ipc-controller";

export class WarcraftInstallationController implements IpcController {
  public constructor(private readonly preferenceStore: Store) {}

  public register(): void {
    ipcMain.handle(IPC_WARCRAFT_INSTALLATIONS_GET_ALL, () => this.getAll());
    ipcMain.handle(IPC_WARCRAFT_INSTALLATIONS_SET_ALL, (_evt, installations: WowInstallation[]) =>
      this.setAll(installations),
    );
    ipcMain.handle(IPC_WARCRAFT_INSTALLATIONS_ADD, (_evt, installation: WowInstallation) => this.add(installation));
    ipcMain.handle(IPC_WARCRAFT_INSTALLATIONS_REMOVE, (_evt, installationId: string) => this.remove(installationId));
    ipcMain.handle(IPC_WARCRAFT_INSTALLATIONS_UPDATE, (_evt, installation: WowInstallation) =>
      this.update(installation),
    );
    ipcMain.handle(IPC_WARCRAFT_INSTALLATIONS_REORDER, (_evt, installationId: string, direction: number) =>
      this.reorder(installationId, direction),
    );
    ipcMain.handle(IPC_WARCRAFT_INSTALLATIONS_SET_SELECTED, (_evt, installationId: string) =>
      this.setSelected(installationId),
    );
  }

  public getAll(): WowInstallation[] {
    return (this.preferenceStore.get(WOW_INSTALLATIONS_KEY) as WowInstallation[] | undefined) ?? [];
  }

  public setAll(installations: WowInstallation[]): WowInstallation[] {
    this.preferenceStore.set(WOW_INSTALLATIONS_KEY, installations);
    return installations;
  }

  public add(installation: WowInstallation): WowInstallation[] {
    const installations = this.getAll();
    const exists = installations.some((inst) => inst.location === installation.location);
    if (exists) {
      throw new Error(`Installation already exists: ${installation.location}`);
    }

    installations.push(installation);

    return this.setAll(installations);
  }

  public remove(installationId: string): WowInstallation[] {
    const installations = this.getAll();
    const exists = installations.some((inst) => inst.id === installationId);
    if (!exists) {
      throw new Error(`Installation does not exist: ${installationId}`);
    }

    return this.setAll(installations.filter((inst) => inst.id !== installationId));
  }

  public update(installation: WowInstallation): WowInstallation[] {
    const installations = this.getAll();
    const matchIndex = installations.findIndex((inst) => inst.id === installation.id);
    if (matchIndex === -1) {
      throw new Error("No installation to update");
    }

    installations.splice(matchIndex, 1, installation);

    return this.setAll(installations);
  }

  public reorder(installationId: string, direction: number): WowInstallation[] {
    const installations = this.getAll();
    const originIndex = installations.findIndex((inst) => inst.id === installationId);
    if (originIndex === -1) {
      return installations;
    }

    const newIndex = originIndex + direction;
    if (newIndex < 0 || newIndex >= installations.length) {
      return installations;
    }

    [installations[newIndex], installations[originIndex]] = [installations[originIndex], installations[newIndex]];

    return this.setAll(installations);
  }

  public setSelected(installationId: string): WowInstallation[] {
    const installations = this.getAll();
    for (const installation of installations) {
      installation.selected = installation.id === installationId;
    }

    return this.setAll(installations);
  }
}
