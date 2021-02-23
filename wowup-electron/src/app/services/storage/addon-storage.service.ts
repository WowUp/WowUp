import { Injectable } from "@angular/core";
import * as Store from "electron-store";
import { Addon } from "../../entities/addon";
import { WowClientType } from "../../models/warcraft/wow-client-type";

@Injectable({
  providedIn: "root",
})
export class AddonStorageService {
  private readonly _store = new Store({
    name: "addons",
  });

  constructor() {}

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

  public saveAll(addons: Addon[]): void {
    addons.forEach((addon) => this.set(addon.id, addon));
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
    const addons = this.getAllForInstallation(installationId);
    addons.forEach((addon) => this._store.delete(addon.id));
  }

  public getByExternalId(externalId: string, clientType: WowClientType): Addon {
    const addons: Addon[] = [];

    for (const result of this._store) {
      const addon = result[1] as Addon;
      if (addon.clientType === clientType && addon.externalId === externalId) {
        addons.push(addon);
        break;
      }
    }

    return addons[0];
  }

  public getAllForInstallation(installationId: string, validator?: (addon: Addon) => boolean): Addon[] {
    const addons: Addon[] = [];

    this.query((store) => {
      for (const result of store) {
        const addon = result[1] as Addon;
        if (addon.installationId === installationId && (!validator || validator(addon))) {
          addons.push(addon);
        }
      }
    });

    return addons;
  }
}
