import * as NodeCache from "node-cache";

const _cache = new NodeCache();

export function get<T>(key: string): T | undefined {
  return _cache.get<T>(key);
}

export function set<T>(key: string, value: T, ttlSec = 600): boolean {
  return _cache.set<T>(key, value, ttlSec);
}

export async function transaction<T>(key: string, missingAction: () => Promise<T>, ttlSec = 600): Promise<T> {
  const cached = get<T>(key);
  if (cached !== undefined && cached !== null) {
    return cached;
  }

  const result = await missingAction?.call(null);

  if (result !== undefined && result !== null) {
    set(key, result, ttlSec);
  }

  return result;
}
