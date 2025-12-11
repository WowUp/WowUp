/**
 * Caching Service for Main Process
 *
 * Simple wrapper around NodeCache for consistent caching across main process services.
 * Matches the API surface of the renderer CachingService for compatibility.
 */

import * as NodeCache from "node-cache";

export class CachingService {
  private readonly _cache = new NodeCache();

  /**
   * Get a cached value by key
   */
  public get<T>(key: string): T | undefined {
    return this._cache.get<T>(key);
  }

  /**
   * Set a value in the cache with optional TTL
   */
  public set<T>(key: string, value: T, ttlSec = 600): boolean {
    return this._cache.set<T>(key, value, ttlSec);
  }

  /**
   * Transaction pattern: get from cache or execute action and cache result
   *
   * @param key Cache key
   * @param missingAction Function to execute if cache miss
   * @param ttlSec Time to live in seconds (default: 600 = 10 minutes)
   */
  public async transaction<T>(key: string, missingAction: () => Promise<T>, ttlSec = 600): Promise<T> {
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

  /**
   * Delete a key from the cache
   */
  public del(key: string): number {
    return this._cache.del(key);
  }

  /**
   * Clear all cached values
   */
  public flushAll(): void {
    this._cache.flushAll();
  }

  /**
   * Get cache statistics
   */
  public getStats(): NodeCache.Stats {
    return this._cache.getStats();
  }
}
