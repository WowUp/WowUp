// electron-updater skips an update when the running OS is older than the update info's minimumSystemVersion, but it
// compares against os.release(), which on macOS is the Darwin kernel version (macOS 12 is Darwin 21), not the
// marketing version that mac.minimumSystemVersion and LSMinimumSystemVersion use.

// Marketing major version to Darwin major version. Not a fixed offset: macOS 26 is Darwin 25.
const DARWIN_MAJOR_BY_MACOS_MAJOR = {
  11: 20,
  12: 21,
  13: 22,
  14: 23,
  15: 24,
  26: 25,
};

/**
 * The Darwin version, as os.release() reports it, of the first release of a macOS version ("12.0" -> "21.0.0").
 * Throws for a version missing from the table, so raising the minimum macOS can't publish a wrong update gate.
 */
function macOsToDarwinVersion(macOsVersion) {
  const major = Number.parseInt(String(macOsVersion).split(".")[0], 10);
  const darwinMajor = DARWIN_MAJOR_BY_MACOS_MAJOR[major];
  if (darwinMajor === undefined) {
    throw new Error(`No Darwin version known for macOS ${macOsVersion}, add it to electron-build/macos-version.js`);
  }
  return `${darwinMajor}.0.0`;
}

module.exports = { macOsToDarwinVersion };
