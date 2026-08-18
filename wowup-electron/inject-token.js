const fs = require("fs");
const path = require("path");

console.log("CURSEFORGE_API_KEY from process.env:", process.env.CURSEFORGE_API_KEY);
const apiToken = process.env.CURSEFORGE_API_KEY || "UNKNOWN";
console.log("Using API token:", apiToken === "UNKNOWN" ? "UNKNOWN" : "[REDACTED]");

const environmentsPath = "./src/environments";
const envFiles = fs.readdirSync(environmentsPath);

for (const envFile of envFiles) {
  // Only process files that end with ow.ts (OW builds)
  if (!envFile.endsWith('ow.ts')) {
    console.log(`Skipping ${envFile} (not an OW environment file)`);
    continue;
  }

  console.log(`Processing ${envFile}...`);
  const p = path.join(environmentsPath, envFile);

  let fileData = fs.readFileSync(p, { encoding: "utf-8" });

  // Split into lines for easier processing
  const lines = fileData.split('\n');
  let inCurseforgeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if we're entering the curseforge block
    if (line.trim().startsWith('curseforge:')) {
      inCurseforgeBlock = true;
    }

    // If we're in the curseforge block and find apiKey, replace it
    if (inCurseforgeBlock && line.includes('apiKey:')) {
      lines[i] = line.replace(/apiKey:\s*"[^"]*"/, `apiKey: "${apiToken}"`);
      lines[i] = lines[i].replace(/apiKey:\s*\{\{CURSEFORGE_API_KEY\}\}/, `apiKey: "${apiToken}"`);
      inCurseforgeBlock = false; // Reset after finding apiKey
    }

    // Check if we've exited the curseforge block
    if (inCurseforgeBlock && line.trim() === '},') {
      inCurseforgeBlock = false;
    }
  }

  fileData = lines.join('\n');
  fs.writeFileSync(p, fileData);
}
