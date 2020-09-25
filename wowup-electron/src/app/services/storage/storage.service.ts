import { Injectable } from "@angular/core";
import * as Store from 'electron-store'

const PREFERENCE_PREFIX = 'preferences';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  private readonly _store = new Store();

  constructor() {
  }

  public set(key: string, value: any) {
    this._store.set(key, value);
  }

  public get<T>(key: string): T {
    return this._store.get(key) as T;
  }

  public setPreference(key: string, value: any) {
    this.set(`${PREFERENCE_PREFIX}.${key}`, value);
  }

  public getPreference<T>(key: string): T {
    return this.get(`${PREFERENCE_PREFIX}.${key}`);
  }
}