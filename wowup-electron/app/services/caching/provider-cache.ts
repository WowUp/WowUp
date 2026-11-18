import NodeCache = require("node-cache");

/** Main's port of the renderer's `CachingService`: a ttl cache with a fill-on-miss helper */
export class ProviderCache {
  public constructor(private readonly _cache: NodeCache = new NodeCache()) {}

  public get<T>(key: string): T | undefined {
    return this._cache.get<T>(key);
  }

  public set<T>(key: string, value: T, ttlSec = 600): boolean {
    return this._cache.set<T>(key, value, ttlSec);
  }

  /** The cached value, or the action's result, cached for `ttlSec` unless it is null or undefined */
  public async transaction<T>(key: string, missingAction: () => Promise<T>, ttlSec = 600): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined && cached !== null) {
      return cached;
    }

    const result = await missingAction();
    if (result !== undefined && result !== null) {
      this.set(key, result, ttlSec);
    }
    return result;
  }
}
