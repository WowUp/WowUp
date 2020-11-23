export interface CacheItem<T> {
  expires: number;
  value: T;
}
