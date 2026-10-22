// Sets the shell's package.json for a flavor: name, productName and repository, plus the version from
// wowup-electron/package.json so the app and the shell share one version number. productName decides the
// user data folder (WowUp vs WowUpCf), in dev and in installed apps alike, so it has to match what installed
// apps already use. Called by wowup-electron's app-env/inject-env.js (every dev and app build) and by
// scripts/prepare-package.js (every installer build). See wowup-electron/SHELL_BUNDLE_PLAN.md.
//
//   node scripts/set-flavor.js <wago|ow>
const fs = require("node:fs");
const path = require("path");

const FLAVORS = {
  wago: { name: "wowup", productName: "WowUp", repository: "https://github.com/WowUp/WowUp.git" },
  ow: { name: "wowup-cf", productName: "WowUpCf", repository: "https://github.com/WowUp/WowUp.CF.git" },
};

const root = path.join(__dirname, "..");

function setFlavor(flavor) {
  if (!FLAVORS[flavor]) {
    throw new Error(`Unknown flavor "${flavor}", expected one of ${Object.keys(FLAVORS).join(", ")}`);
  }

  const appPackage = JSON.parse(fs.readFileSync(path.join(root, "..", "wowup-electron", "package.json"), "utf8"));
  const packagePath = path.join(root, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  packageJson.name = FLAVORS[flavor].name;
  packageJson.productName = FLAVORS[flavor].productName;
  packageJson.repository.url = FLAVORS[flavor].repository;
  packageJson.version = appPackage.version;
  fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

  return packageJson;
}

module.exports = { setFlavor };

if (require.main === module) {
  try {
    const { productName, version } = setFlavor(process.argv[2]);
    console.log(`Shell set to ${productName} ${version}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
