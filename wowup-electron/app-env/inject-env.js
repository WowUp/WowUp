const fs = require("node:fs");
const path = require("path");

if (process.env.BUILD_FLAVOR.length === 0) {
  throw new Error("BUILD_FLAVOR is required");
}

console.debug("injecting env", process.env.BUILD_FLAVOR);
const envPath = path.join(__dirname, "..", "app", "env", "environment.ts");

let envData = fs.readFileSync(envPath, "utf8");

envData = envData.replace(/buildFlavor: ".*"/, `buildFlavor: "${process.env.BUILD_FLAVOR}"`);

console.debug(envData);

fs.writeFileSync(envPath, envData);

// The app's name and productName (which decides the user data folder) belong to the shell, which is what
// Electron actually runs, in dev and in installers
require("../../wowup-shell/scripts/set-flavor").setFlavor(process.env.BUILD_FLAVOR);
