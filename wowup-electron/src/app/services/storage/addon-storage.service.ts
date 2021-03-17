import * as Store from "electron-store";

import { Injectable } from "@angular/core";

import { IPC_ADDONS_SAVE_ALL } from "../../../common/constants";
import { Addon } from "../../../common/entities/addon";
import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class AddonStorageService {
  private readonly _store = new Store({
    name: "addons",
  });

  public constructor(private _electronService: ElectronService) {}

  public query<T>(action: (store: Store) => T): T {
    return action(this._store);
  }

  public queryAll(action: (item: Addon) => boolean): Addon[] {
    const addons: Addon[] = [];
    for (const item of this._store) {
      const addon = item[1] as Addon;
      if (action(addon)) {
        addons.push(addon);
      }
    }

    return addons;
  }

  public async saveAll(addons: Addon[]): Promise<void> {
    await this._electronService.invoke(IPC_ADDONS_SAVE_ALL, addons);
    // addons.forEach((addon) => this.set(addon.id, addon));
  }

  public set(key: string, value: Addon): void {
    this._store.set(key, value);
  }

  public get(key: string): Addon {
    return this._store.get(key) as Addon;
  }

  public removeAll(...addons: Addon[]): void {
    addons.forEach((addon) => this.remove(addon));
  }

  public remove(addon: Addon): void {
    this._store.delete(addon.id);
  }

  public removeAllForInstallation(installationId: string): void {
    const addons = this.getAllForInstallationId(installationId);
    addons.forEach((addon) => this._store.delete(addon.id));
  }

  public getByExternalId(externalId: string, installationId: string): Addon {
    const addons: Addon[] = [];

    for (const result of this._store) {
      const addon = result[1] as Addon;
      if (addon.installationId === installationId && addon.externalId === externalId) {
        addons.push(addon);
        break;
      }
    }

    return addons[0];
  }

  public getAll(): Addon[] {
    const addons: Addon[] = [];

    for (const result of this._store) {
      const addon = result[1] as Addon;
      addons.push(addon);
    }

    return addons;
  }

  public getAllForInstallationId(installationId: string, validator?: (addon: Addon) => boolean): Addon[] {
    const addons: Addon[] = [];

    for (const result of this._store) {
      const addon = result[1] as Addon;
      if (addon.installationId === installationId && (!validator || validator(addon))) {
        addons.push(addon);
      }
    }

    return addons;
  }
}
