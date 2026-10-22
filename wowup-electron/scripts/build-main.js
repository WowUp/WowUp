// Builds the app bundle's main process, see SHELL_BUNDLE_PLAN.md:
//   app/main.ts and app/preload.ts -> app-build/bundle/{main,preload}.js, plus assets/
// The shell is built separately in wowup-shell and loads the bundle by runtime path. app-build/bundle/ is
// the whole bundle: ng build writes the UI into app-build/bundle/renderer/ and scripts/build-bundle.mts
// packages the folder. Type checking is done separately with `tsc -p tsconfig.serve.json`.
const esbuild = require("esbuild");
const fs = require("node:fs");
const path = require("path");

const root = path.join(__dirname, "..");
const outRoot = path.join(root, "app-build");

// Loaded from node_modules at runtime instead of being bundled:
// - electron is provided by the runtime
// - electron-log is initialized once by the shell and shared with the bundle
// - electron-updater updates the shell itself
// - win-ca loads native addons and roots.exe from next to its own files
// - electron-reload is only used when serving
const external = ["electron", "electron-log", "electron-updater", "win-ca", "electron-reload"];

const common = {
  absWorkingDir: root,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  sourcemap: true,
  external,
  logLevel: "warning",
};

async function build() {
  const bundleDir = path.join(outRoot, "bundle");

  // Clear out what this script produces, plus output from older builds (app-build/app, app-build/shell). The
  // renderer is left alone: ng build owns it and usually runs after this.
  for (const stale of [
    "shell",
    "app",
    "bundle/main.js",
    "bundle/main.js.map",
    "bundle/preload.js",
    "bundle/preload.js.map",
    "bundle/assets",
  ]) {
    fs.rmSync(path.join(outRoot, stale), { recursive: true, force: true });
  }

  await esbuild.build({ ...common, entryPoints: ["app/main.ts", "app/preload.ts"], outdir: bundleDir });

  fs.cpSync(path.join(root, "assets"), path.join(bundleDir, "assets"), { recursive: true });
}

build().catch(() => {
  // esbuild has already printed the errors
  process.exit(1);
});
