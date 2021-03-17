import { Injectable } from "@angular/core";
import * as Store from "electron-store";

@Injectable({
  providedIn: "root",
})
export class PreferenceStorageService {
  private readonly _store = new Store({
    name: "preferences",
  });

  public query<T>(action: (items: Store) => T): T {
    return action(this._store);
  }

  public set(key: string, value: any): void {
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

  public getObject<T>(key: string): T | undefined {
    return this._store.get(key, undefined) as T;
  }

  public remove(key: string): void {
    this._store.delete(key);
  }
}
