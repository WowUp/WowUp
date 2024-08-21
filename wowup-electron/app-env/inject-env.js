const fs = require("node:fs");
const path = require("path");

console.debug("injecting env", process.env.BUILD_FLAVOR);
const envPath = path.join(__dirname, "..", "app", "env", "environment.ts");

let envData = fs.readFileSync(envPath, "utf8");

envData = envData.replace(/buildFlavor: ".*"/, `buildFlavor: "${process.env.BUILD_FLAVOR}"`);

console.debug(envData);

fs.writeFileSync(envPath, envData);
