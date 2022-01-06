import * as Store from "electron-store";

import { Injectable } from "@angular/core";

import { IPC_STORE_GET_OBJECT, PREFERENCE_STORE_NAME } from "../../../common/constants";
import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class PreferenceStorageService {
  private readonly _store = new Store({
    name: "preferences",
  });

  public constructor(private _electronService: ElectronService) {}

  public query<T>(action: (items: Store) => T): T {
    return action(this._store);
  }

  public set(key: string, value: unknown): void {
    this._store.set(key, value.toString());
  }

  public get(key: string): string {
    return this._store.get(key) as string;
  }

  public findByKey(key: string): string {
    return this._store.get(key) as string;
  }

  public setObject<T>(key: string, object: T): void {
    this._store.set(key, object);
  }

  public getObjectAsync<T>(key: string): Promise<T | undefined> {
    return this._electronService.invoke(IPC_STORE_GET_OBJECT, PREFERENCE_STORE_NAME, key);
  }

  public remove(key: string): void {
    this._store.delete(key);
  }
}
