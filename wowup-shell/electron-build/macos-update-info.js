// Writes the minimum macOS into latest-mac.yml (and the other mac channel files), so installs on an older macOS don't
// download and install an update that can't run there. See macos-version.js for why it is a Darwin version.
//
// electron-builder only uses mac.minimumSystemVersion for Info.plist's LSMinimumSystemVersion, and its releaseInfo
// option doesn't accept the key. The update info's top level is built from the platform's releaseInfo each time an
// artifact is created, after this artifactBuildCompleted hook runs, so the key is added there.
const { macOsToDarwinVersion } = require("./macos-version");

module.exports = function (event) {
  const { packager } = event;
  if (packager.platform.nodeName !== "darwin") {
    return;
  }

  const options = packager.platformSpecificBuildOptions;
  if (options.minimumSystemVersion == null) {
    throw new Error(
      "mac.minimumSystemVersion must be set so updates aren't offered to macOS versions they can't run on",
    );
  }

  const minimumSystemVersion = macOsToDarwinVersion(options.minimumSystemVersion);
  const releaseInfo = options.releaseInfo || packager.config.releaseInfo || {};
  if (releaseInfo.minimumSystemVersion === minimumSystemVersion) {
    return;
  }
  options.releaseInfo = { ...releaseInfo, minimumSystemVersion };
  console.log(`Update info requires macOS ${options.minimumSystemVersion} (Darwin ${minimumSystemVersion})`);
};
