export function getEnumKeys(enume: Record<string, unknown>): string[] {
  return Object.keys(enume).filter((k) => typeof enume[k as any] === "number"); // ["A", "B"]
}

export function getEnumList<T>(enume: Record<string, unknown>): T[] {
  const keys = getEnumKeys(enume);
  return keys.map((k) => enume[k as any]) as T[];
}

export function getEnumName(enume: Record<string, unknown>, value: number): string {
  return enume[value] as string;
}
