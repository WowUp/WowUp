const fs = require("fs");
const path = require("path");

const apiToken = process.env.CURSEFORGE_API_KEY || "UNKNOWN";

const environmentsPath = "./src/environments";
const envFiles = fs.readdirSync(environmentsPath);

for (const envFile of envFiles) {
  const p = path.join(environmentsPath, envFile);

  let fileData = fs.readFileSync(p, { encoding: "utf-8" });
  fileData = fileData.replace("{{CURSEFORGE_API_KEY}}", apiToken);

  fs.writeFileSync(p, fileData);
}
