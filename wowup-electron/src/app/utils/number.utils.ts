export function shortenDownloadCount(value: number, nDigit: number): string {
  if (value < 10) {
    return value.toString();
  }
  const exponent = Math.log10(value);
  const nGroups = Math.floor(exponent / nDigit);
  const shortValue = value / Math.pow(10, nGroups * nDigit);
  return shortValue.toFixed(0);
}

export function formatSize(size: number): string {
  if (size < 1024) {
    return `${size} bytes`;
  }

  const sizeKb = Math.round(size / 1024);
  if (sizeKb < 1024) {
    return `${sizeKb} kb`;
  }

  const sizeMb = Math.round(size / 1024 / 1024);
  return `${sizeMb} mb`;
}

// This is a horrifying way to round to the nearest tens place
export function roundDownloadCount(value: number): number {
  if (value < 10) {
    return value;
  }
  const exp = value.toExponential();
  const numberMatch = /(\d*\.?\d*)e\+(\d+)/.exec(exp);
  if (numberMatch === null) {
    throw new Error("failed to get number match");
  }

  const number = Math.ceil(parseFloat(numberMatch[1]) * 10);
  const exponent = new Array(parseInt(numberMatch[2] ?? "0") - 1).fill(0);
  return parseInt(`${number}${exponent.join("")}`, 10);
}
