import { createHash } from "crypto";

export function stringIncludes(value: string | undefined, search: string): boolean {
  if (!value) {
    return false;
  }
  return value.trim().toLowerCase().indexOf(search.trim().toLowerCase()) >= 0;
}

export function camelToSnakeCase(str: string): string {
  // if the string is all caps, ignore it
  if (str.toUpperCase() === str) {
    return str;
  }

  const originalStart = str.charAt(0);
  return originalStart + str.slice(1).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Get the sha1 hash of a string
 */
export function getSha1Hash(str: string): string {
  return createHash("sha1").update(str).digest("hex");
}

export function capitalizeString(str: string): string {
  return str.charAt(0).toUpperCase() + str.toLowerCase().slice(1);
}

export function isProtocol(arg: string): boolean {
  return getProtocol(arg) != null;
}

export function getProtocol(arg: string): string | null {
  const match = /^([a-z][a-z0-9+\-.]*):/.exec(arg);
  return match !== null && match.length > 1 ? match[1] : null;
}
