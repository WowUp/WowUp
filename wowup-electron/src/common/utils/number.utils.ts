export function isBetween(val: number, min: number, max: number, inclusive: boolean = false) {
  if (inclusive) {
    return val >= min && val <= max;
  } else {
    return val > min && val < max;
  }
}
