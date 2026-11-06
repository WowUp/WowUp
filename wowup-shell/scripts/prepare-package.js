// Prepares the shell for an installer build of one flavor, see wowup-electron/SHELL_BUNDLE_PLAN.md: checks the
// bundle wowup-electron packaged (app-build/packed/) is there, for this flavor and version, since the installer
// ships it as resources/bundle/; then sets the shell's package.json for the flavor (see set-flavor.js).
//
//   node scripts/prepare-package.js <wago|ow>
const fs = require("node:fs");
const path = require("path");

const { setFlavor } = require("./set-flavor");

const flavor = process.argv[2];
const appRoot = path.join(__dirname, "..", "..", "wowup-electron");
const version = JSON.parse(fs.readFileSync(path.join(appRoot, "package.json"), "utf8")).version;

const manifestPath = path.join(appRoot, "app-build", "packed", "bundle-manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error(`No packaged bundle at ${manifestPath}; build it in wowup-electron first`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifest.flavor !== flavor || manifest.version !== version) {
  console.error(
    `The packaged bundle is ${manifest.flavor} ${manifest.version}, not ${flavor} ${version}; rebuild it in wowup-electron`,
  );
  process.exit(1);
}

try {
  const { productName } = setFlavor(flavor);
  console.log(`Prepared ${productName} ${version} with the ${flavor} bundle`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
