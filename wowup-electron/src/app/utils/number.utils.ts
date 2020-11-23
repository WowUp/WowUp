export function shortenDownloadCount(value: number, nDigit: number): string {
  if (value < 10) {
    return value.toString();
  }
  const exponent = Math.log10(value);
  const nGroups = Math.floor(exponent / nDigit);
  const shortValue = value / Math.pow(10, nGroups * nDigit);
  return shortValue.toFixed(0);
}

// This is a horrifying way to round to the nearest tens place
export function roundDownloadCount(value: number): number {
  if (value < 10) {
    return value;
  }
  const exp = value.toExponential();
  const numberMatch = /(\d*\.?\d*)e\+(\d+)/.exec(exp);
  const number = Math.ceil(parseFloat(numberMatch[1]) * 10);
  const exponent = new Array(parseInt(numberMatch[2]) - 1).fill(0);
  return parseInt(`${number}${exponent.join("")}`, 10);
}
