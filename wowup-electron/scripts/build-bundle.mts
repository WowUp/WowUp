// Packages app-build/bundle/ (built by scripts/build-main.js and ng build) as a bundle, see
// SHELL_BUNDLE_PLAN.md. Writes to app-build/packed/:
//  - bundle/               the bundle as it's shipped: no source maps. The installer ships it as
//                          resources/bundle/ and the shell loads it from there.
//  - bundle.zip            the same folder as a single download
//  - bundle-manifest.json  the manifest, signed with BUNDLE_SIGNING_KEY(_ID) when set, else the local key
// Bundles are folders, not .asar files: Electron's embedded asar integrity check (on in ow-electron)
// refuses .asar files the exe doesn't list. Runs after `build` / `ow:build` as their npm post-scripts.
import AdmZip from "adm-zip";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  hashBundleDirectory,
  sha256Hex,
  type UnsignedBundleManifest,
} from "../../wowup-shell/contract/bundle-manifest.ts";
import { SHELL_API_VERSION } from "../../wowup-shell/contract/shell-api.ts";
import { getLocalKey, LOCAL_KEY_ID } from "./lib/local-key.mts";
import { hasSigningKey, signWithEnvKey, signWithKey } from "./lib/signing.mts";

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

// Written by scripts/build-main.js: the flavor and version the bundle's code was actually built with, which
// app/env/environment.ts and package.json may no longer match if the bundle is packaged on its own later
const buildInfoPath = join(root, "app-build", "bundle-build.json");
if (!existsSync(buildInfoPath)) {
  console.error("app-build/bundle-build.json is missing; run the build first");
  process.exit(1);
}
const { flavor, version } = JSON.parse(readFileSync(buildInfoPath, "utf8")) as { flavor: string; version: string };

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
// The shell checks the built-in bundle's signature too, so the manifest is always signed: with the real key in
// release builds (CI sets it), otherwise with the throwaway local key, which only a shell packaged from this
// bundle trusts
const signed = hasSigningKey() ? signWithEnvKey(manifest) : signWithKey(manifest, LOCAL_KEY_ID, getLocalKey());
writeFileSync(join(outDir, "bundle-manifest.json"), JSON.stringify(signed, null, 2));

const size = `${(zipped.length / 1024 / 1024).toFixed(1)} MB zip`;
console.log(`Packaged ${flavor} ${version} bundle: ${size}, manifest signed with ${signed.keyId}`);
