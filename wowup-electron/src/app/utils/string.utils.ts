import { createHash } from "crypto";

export function stringIncludes(value: string, search: string) {
  if (value == null) {
    return false;
  }
  return value.trim().toLowerCase().indexOf(search.trim().toLowerCase()) >= 0;
}

/**
 * Get the sha1 hash of a string
 */
export function getSha1Hash(str: string): string {
  const shasum = createHash("sha1");
  shasum.update(str);
  return shasum.digest("hex");
}

export function capitalizeString(str: string): string {
  return str.charAt(0).toUpperCase() + str.toLowerCase().slice(1);
}
