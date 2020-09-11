import { Injectable } from "@angular/core";
import { CacheItem } from "app/models/cache-item";

@Injectable({
  providedIn: 'root'
})
export class CachingService {

  private readonly _cache: { [key: string]: CacheItem<any> } = {};

  constructor() { }

  get<T>(key: string): T {
    if (!(key in this._cache)) {
      return undefined;
    }

    const now = new Date().getTime();
    const cacheItem = this._cache[key];

    if (now >= cacheItem.expires) {
      delete this._cache[key];
      return undefined;
    }

    return cacheItem.value as T;
  }

  set(key: string, value: any, ttlMs = 0) {
    const cacheItem: CacheItem<any> = {
      expires: new Date().getTime() + ttlMs,
      value
    };

    this._cache[key] = cacheItem;
  }
}