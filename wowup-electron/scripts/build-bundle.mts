// Packages app-build/bundle/ (built by scripts/build-main.js and ng build) as a bundle, see
// SHELL_BUNDLE_PLAN.md. Writes to app-build/packed/:
//  - bundle/               the bundle as it's shipped: no source maps. The installer ships it as
//                          resources/bundle/ and the shell loads it from there.
//  - bundle.zip            the same folder as a single download
//  - bundle-manifest.json  the unsigned manifest; scripts/sign-manifest.mts signs it
// Bundles are folders, not .asar files: Electron's embedded asar integrity check (on in ow-electron)
// refuses .asar files the exe doesn't list. Runs after `build` / `ow:build` as their npm post-scripts.
import AdmZip from "adm-zip";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { hashBundleDirectory, sha256Hex, type UnsignedBundleManifest } from "../app/shell/bundle-manifest.ts";
import { SHELL_API_VERSION } from "../app/shell/shell-api.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundleDir = join(root, "app-build", "bundle");
const outDir = join(root, "app-build", "packed");
const stagedDir = join(outDir, "bundle");
const zipPath = join(outDir, "bundle.zip");

for (const required of ["main.js", "preload.js", "renderer/index.html", "assets"]) {
  if (!existsSync(join(bundleDir, required))) {
    console.error(`app-build/bundle/${required} is missing; run the build first`);
    process.exit(1);
  }
}

const version: string = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const flavor = /buildFlavor: "(\w+)"/.exec(readFileSync(join(root, "app", "env", "environment.ts"), "utf8"))?.[1];
if (flavor === undefined) {
  console.error("Could not read buildFlavor from app/env/environment.ts");
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// Source maps stay in the dev folder; nothing loads them at runtime
cpSync(bundleDir, stagedDir, { recursive: true, filter: (source) => !source.endsWith(".map") });

const zip = new AdmZip();
zip.addLocalFolder(stagedDir);
zip.writeZip(zipPath);
const zipped = readFileSync(zipPath);

// channel, urls, rolloutPercent and revoked are set again when a bundle is published
const manifest: UnsignedBundleManifest = {
  flavor,
  channel: version.includes("-beta") ? "beta" : "stable",
  shellApi: SHELL_API_VERSION,
  version,
  sha256: sha256Hex(zipped),
  contentSha256: hashBundleDirectory(stagedDir),
  urls: [],
  rolloutPercent: 100,
  revoked: [],
  issuedAt: new Date().toISOString(),
};
writeFileSync(join(outDir, "bundle-manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`Packaged ${flavor} ${version} bundle: ${(zipped.length / 1024 / 1024).toFixed(1)} MB zip`);
