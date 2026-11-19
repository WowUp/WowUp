// Release feeds name the oldest OS a release runs on (latest-mac.yml's minimumSystemVersion, written by
// wowup-shell/electron-build/macos-update-info.js), and electron-updater skips releases that need a newer OS. These
// helpers tell when that happened, so the user hears why they aren't getting updates.

// os.release() on macOS is the Darwin version; this names the macOS that shipped with each Darwin major version
const MACOS_BY_DARWIN_MAJOR: Record<number, string> = {
  20: "11",
  21: "12",
  22: "13",
  23: "14",
  24: "15",
  25: "26",
};

function parseVersion(version: string): number[] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  return match === null ? undefined : match.slice(1).map((part) => Number(part));
}

/**
 * Whether electron-updater skipped an update because the OS is older than it needs, using the same rule as
 * electron-updater: the OS version is less than the update's minimumSystemVersion. Unparsable versions don't count,
 * as electron-updater doesn't skip the update for them either.
 */
export function isUpdateUnsupportedOnOs(minimumSystemVersion: string | undefined, osRelease: string): boolean {
  if (!minimumSystemVersion) {
    return false;
  }
  const required = parseVersion(minimumSystemVersion);
  const current = parseVersion(osRelease);
  if (required === undefined || current === undefined) {
    return false;
  }
  for (let i = 0; i < required.length; i++) {
    if (current[i] !== required[i]) {
      return current[i] < required[i];
    }
  }
  return false;
}

/** The macOS version ("12") for a Darwin version ("21.0.0"), or undefined when it isn't known */
export function darwinToMacOsVersion(darwinVersion: string): string | undefined {
  const parsed = parseVersion(darwinVersion);
  return parsed === undefined ? undefined : MACOS_BY_DARWIN_MAJOR[parsed[0]];
}
