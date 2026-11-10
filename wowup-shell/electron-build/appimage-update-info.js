// Embeds AppImage update information and publishes a .zsync file next to the AppImage, so AppImageUpdate,
// Gear Lever, AppManager and the like can find and apply updates.
// See https://github.com/AppImage/AppImageSpec/blob/master/draft.md#update-information
//
// electron-builder has no option for this, so this artifactBuildCompleted hook writes the .upd_info section of the
// finished AppImage. That changes the file after electron-builder appended its block map and hashed it for
// latest-linux.yml, so the block map is rebuilt and the event's update info replaced before electron-builder uses it.
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const { getPublishConfigs } = require("app-builder-lib/out/publish/PublishManager");
const { appendBlockmap } = require("app-builder-lib/out/targets/differentialUpdateInfoBuilder");

module.exports = async function (event) {
  const { file, packager } = event;
  if (!file.endsWith(".AppImage")) {
    return;
  }

  // The publish configurations electron-builder resolves for the AppImage, with the GitHub owner and repo filled in
  const publishConfigs = (await getPublishConfigs(packager, event.target.options, event.arch, false)) || [];
  const github = publishConfigs.find((p) => p.provider === "github");
  if (github == null) {
    return;
  }
  const zsyncName = `${path.basename(file).replace(packager.appInfo.version, "*")}.zsync`;
  const updateInformation = `gh-releases-zsync|${github.owner}|${github.repo}|latest|${zsyncName}`;

  // File offset and size of the AppImage runtime's .upd_info section
  const sections = childProcess.execFileSync("readelf", ["-S", "-W", file], { encoding: "utf8" });
  const [, offset, size] = sections.match(/\.upd_info\s+\S+\s+\S+\s+(\S+)\s+(\S+)/).map((n) => parseInt(n, 16));
  if (updateInformation.length >= size) {
    throw new Error(`Update information is longer than the ${size} byte .upd_info section`);
  }

  // Drop the block map electron-builder appended (block map, then its size as a 4 byte integer)
  fs.truncateSync(file, event.updateInfo.size - event.updateInfo.blockMapSize - 4);
  const fd = fs.openSync(file, "r+");
  try {
    fs.writeSync(fd, updateInformation, offset, "ascii");
  } finally {
    fs.closeSync(fd);
  }
  event.updateInfo = await appendBlockmap(file);
  console.log(`Embedded AppImage update information ${updateInformation}`);

  const zsyncFile = `${file}.zsync`;
  childProcess.execFileSync("zsyncmake", ["-u", path.basename(file), "-o", zsyncFile, file], { stdio: "inherit" });
  // Passing the publish configuration makes electron-builder create its publisher before this hook returns. Without it
  // the publisher is created in the background while the AppImage creates its own, which can make a second release.
  for (const publishConfig of publishConfigs) {
    await packager.info.emitArtifactCreated({
      file: zsyncFile,
      target: event.target,
      arch: event.arch,
      packager,
      publishConfig,
    });
  }
};
