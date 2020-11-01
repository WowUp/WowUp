export function getEnumKeys(enume: object) {
  return Object.keys(enume).filter((k) => typeof enume[k as any] === "number"); // ["A", "B"]
}

export function getEnumList<T>(enume: object): T[] {
  const keys = getEnumKeys(enume);
  return keys.map((k) => enume[k as any]);
}

export function getEnumName(enume: object, value: number): string {
  return enume[value];
}
