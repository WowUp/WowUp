export function strictFilter<T>(arr: (T | undefined)[]): T[] {
  const filtered: T[] = [];
  for (const item of arr) {
    if (item !== undefined) {
      filtered.push(item);
    }
  }
  return filtered;
}

export function strictFilterBy<T>(arr: (T | undefined)[], predicate: (val: T) => boolean): T[] {
  const filtered: T[] = [];
  for (const item of arr) {
    if (item !== undefined && predicate.call(null, item)) {
      filtered.push(item);
    }
  }
  return filtered;
}
