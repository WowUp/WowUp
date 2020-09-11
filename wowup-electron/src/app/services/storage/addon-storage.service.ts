import { Injectable } from "@angular/core";
import { Addon } from "app/entities/addon";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import * as Store from 'electron-store'

const PREFERENCE_PREFIX = 'preferences';

@Injectable({
  providedIn: 'root'
})
export class AddonStorageService {

  private readonly _store = new Store({
    name: 'addons'
  });

  constructor() {
    console.log(this._store)
  }

  public query<T>(action: (items: Store) => T) {
    return action(this._store);
  }

  public setAll(addons: Addon[]) {
    addons.forEach(addon => this.set(addon.id, addon));
  }

  public set(key: string, value: Addon) {
    this._store.set(key, value);
  }

  public get(key: string): Addon {
    return this._store.get(key) as Addon;
  }

  public removeForClientType(clientType: WowClientType) {
    const addons = this.getAllForClientType(clientType);
    addons.forEach(addon => this._store.delete(addon.id));
  }

  public getAllForClientType(
    clientType: WowClientType,
    validator?: (addon: Addon) => boolean
  ) {
    const addons: Addon[] = [];

    this.query(store => {
      for (const result of store) {
        const addon = result[1] as Addon;
        if (addon.clientType === clientType && (!validator || validator(addon))) {
          addons.push(addon);
        }
      }
    });

    return addons;
  }
}