import { Injectable } from "@angular/core";
import * as NodeCache from "node-cache";

@Injectable({
  providedIn: "root",
})
export class CachingService {
  private readonly _cache = new NodeCache();

  get<T>(key: string): T | undefined {
    return this._cache.get<T>(key);
  }

  set<T>(key: string, value: T, ttlSec = 600) {
    return this._cache.set<T>(key, value, ttlSec);
  }
}
