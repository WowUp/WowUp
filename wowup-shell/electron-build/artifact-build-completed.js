// electron-builder takes one artifactBuildCompleted hook; this runs each platform's step in turn.
const appImageUpdateInfo = require("./appimage-update-info");
const macOsUpdateInfo = require("./macos-update-info");

module.exports = async function (event) {
  await macOsUpdateInfo(event);
  await appImageUpdateInfo(event);
};
