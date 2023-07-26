import { createHash } from "crypto";
import { DAY_SECONDS, HOUR_SECONDS, MONTH_SECONDS, YEAR_SECONDS } from "../../common/constants";

export function strIsNotNullOrEmpty(value?: string): boolean{
  return typeof value === 'string' && value.length > 0;
}

export function stringIncludes(value: string | undefined, search: string): boolean {
  if (!value) {
    return false;
  }
  return value.trim().toLowerCase().indexOf(search.trim().toLowerCase()) >= 0;
}

export function removeExtension(str: string): string {
  return str.replace(/\.[^/.]+$/, "");
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

export function getProtocolParts(protocol: string) {
  return new URL(protocol).pathname
    .split("/")
    .filter((part) => !!part)
    .map((part) => part.toLowerCase());
}

export function getRelativeDateFormat(value: string): [string, object | undefined] {
  if (!value) {
    return ["", undefined];
  }

  let then: Date;
  try {
    then = new Date(value);
  } catch (error) {
    return ["", undefined];
  }

  if (isNaN(then.getTime())) {
    return ["", undefined];
  }

  const deltaMs = new Date().getTime() - then.getTime();

  let tempSec = Math.floor(deltaMs / 1000);

  const years = Math.floor(tempSec / YEAR_SECONDS);
  if (years) {
    return ["COMMON.DATES.YEARS_AGO", { count: years }];
  }

  const months = Math.floor((tempSec %= YEAR_SECONDS) / MONTH_SECONDS);
  if (months) {
    return ["COMMON.DATES.MONTHS_AGO", { count: months }];
  }

  const days = Math.floor((tempSec %= MONTH_SECONDS) / DAY_SECONDS);
  if (days > 1) {
    return ["COMMON.DATES.DAYS_AGO", { count: days }];
  }

  if (days) {
    return ["COMMON.DATES.YESTERDAY", undefined];
  }

  const hours = Math.floor((tempSec %= DAY_SECONDS) / HOUR_SECONDS);
  if (hours) {
    return ["COMMON.DATES.HOURS_AGO", { count: hours }];
  }

  // const minutes = Math.floor((tempSec %= HOUR_SECONDS) / MINUTE_SECONDS);
  // if (minutes) {
  //   return [`${tempSec} ago`, undefined];
  // }

  return ["COMMON.DATES.JUST_NOW", undefined];
}
