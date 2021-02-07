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

  set<T>(key: string, value: T, ttlSec = 600): boolean {
    return this._cache.set<T>(key, value, ttlSec);
  }

  async transaction<T>(key: string, missingAction: () => Promise<T>, ttlSec = 600): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined && cached !== null) {
      return cached;
    }

    const result = await missingAction?.call(this);

    if (result !== undefined && result !== null) {
      this.set(key, result, ttlSec);
    }

    return result;
  }
}
