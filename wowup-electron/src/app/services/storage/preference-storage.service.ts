import { Injectable } from "@angular/core";
import * as Store from 'electron-store'
import { Addon } from "../../entities/addon";

const PREFERENCE_PREFIX = 'preferences';

@Injectable({
  providedIn: 'root'
})
export class PreferenceStorageService {

  private readonly _store = new Store({
    name: 'preferences'
  });

  constructor() {
  }

  public query<T>(action: (items: Store) => T) {
    return action(this._store);
  }

  public set(key: string, value: any) {
    this._store.set(key, value.toString());
  }

  public get(key: string): string {
    return this._store.get(key) as string;
  }

  public findByKey(key: string): string{
    return this._store.get(key) as string;
  }
}