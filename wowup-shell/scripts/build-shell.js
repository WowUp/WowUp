// Builds the shell's entry point, src/bootstrap.ts, into dist/bootstrap.js (build/ belongs to node-gyp, for
// the native addon). The app bundle is built separately in wowup-electron and loaded by runtime path, never
// compiled in. See wowup-electron/SHELL_BUNDLE_PLAN.md. Type checking is done with `tsc -p tsconfig.json`.
//
// Bakes in (see src/build-defines.d.ts):
//  - __SHELL_FLAVOR__: from package.json's name, which scripts/set-flavor.js sets
//  - __EXTRA_BUNDLE_KEYS__: the throwaway local key's public half, only when the bundle wowup-electron packaged
//    is signed with it, i.e. a local build without the real signing key. Release builds trust only
//    src/bundle-keys.ts.
//  - __BUNDLE_UPDATE_URLS__: where to check for newer bundles; for that same local build, the
//    `bundle:publish:local --serve` server instead of the real one. BUNDLE_UPDATE_URL (comma-separated)
//    overrides both, e.g. to try a local build against the real hosts. It only changes where manifests come
//    from: they're still checked against the trusted keys.
const crypto = require("node:crypto");
const esbuild = require("esbuild");
const fs = require("node:fs");
const path = require("path");

const LOCAL_KEY_ID = "local-test";
const RELEASE_UPDATE_URL = "https://wowup.github.io/wowup-bundles";
const LOCAL_UPDATE_URL = "http://localhost:8787/pages";

const root = path.join(__dirname, "..");
const outDir = path.join(root, "dist");
const appRoot = path.join(root, "..", "wowup-electron");

function getFlavor() {
  const { name } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  return name === "wowup-cf" ? "ow" : "wago";
}

function isLocalBuild() {
  const manifestPath = path.join(appRoot, "app-build", "packed", "bundle-manifest.json");
  return fs.existsSync(manifestPath) && JSON.parse(fs.readFileSync(manifestPath, "utf8")).keyId === LOCAL_KEY_ID;
}

function getExtraBundleKeys() {
  const keyPath = path.join(appRoot, "app-build", "local-publish", "local-test-key.pem");
  if (!isLocalBuild()) {
    return {};
  }

  const publicKey = crypto
    .createPublicKey(crypto.createPrivateKey(fs.readFileSync(keyPath, "utf8")))
    .export({ type: "spki", format: "pem" })
    .toString();
  console.warn(`Local build: this shell also trusts bundles signed with the "${LOCAL_KEY_ID}" key`);
  return { [LOCAL_KEY_ID]: publicKey };
}

function getUpdateUrls() {
  const override = (process.env.BUNDLE_UPDATE_URL ?? "")
    .split(",")
    .map((url) => url.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  if (override.length > 0) {
    console.warn(`This shell checks for bundle updates at ${override.join(", ")} (BUNDLE_UPDATE_URL)`);
    return override;
  }
  return isLocalBuild() ? [LOCAL_UPDATE_URL] : [RELEASE_UPDATE_URL];
}

async function build() {
  fs.rmSync(outDir, { recursive: true, force: true });

  await esbuild.build({
    absWorkingDir: root,
    entryPoints: ["src/bootstrap.ts"],
    outdir: outDir,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    sourcemap: true,
    // electron is provided by the runtime; electron-log is shared with the bundle, so there must be one copy
    external: ["electron", "electron-log"],
    define: {
      __SHELL_FLAVOR__: JSON.stringify(getFlavor()),
      __EXTRA_BUNDLE_KEYS__: JSON.stringify(getExtraBundleKeys()),
      __BUNDLE_UPDATE_URLS__: JSON.stringify(getUpdateUrls()),
    },
    logLevel: "warning",
  });
}

build().catch((e) => {
  // esbuild has already printed its own errors
  if (!Array.isArray(e.errors)) {
    console.error(e.message);
  }
  process.exit(1);
});
