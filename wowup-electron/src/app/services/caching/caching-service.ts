import { Injectable } from "@angular/core";
import { CacheItem } from "app/models/cache-item";

@Injectable({
  providedIn: 'root'
})
export class CachingService {

  private readonly _cache = new Map<string, CacheItem<any>>();

  constructor() { }

  get<T>(key: string): T {
    if (!this._cache.has(key)) {
      return undefined;
    }

    const now = new Date().getTime();
    const cacheItem = this._cache.get(key);

    if (now >= cacheItem.expires) {
      this._cache.delete(key);
      return undefined;
    }

    return cacheItem.value as T;
  }

  set(key: string, value: any, ttlMs = 60000) {
    const cacheItem: CacheItem<any> = {
      expires: new Date().getTime() + ttlMs,
      value
    };

    this._cache.set(key, cacheItem);
  }
}