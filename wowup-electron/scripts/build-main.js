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
  // Windows Defender takes ~12 s on the first read of the unminified 3.8 MB main.js (every fresh install or
  // bundle update, before any window can show); minified it takes ~0.3 s. Names are kept so stack traces in
  // logs stay readable.
  minifyWhitespace: true,
  minifySyntax: true,
  keepNames: true,
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

  // What this build is, for scripts/build-bundle.mts: the flavor and version compiled in now, rather than
  // whatever app/env/environment.ts and package.json say by the time the bundle is packaged
  const flavor = /buildFlavor: "(\w+)"/.exec(
    fs.readFileSync(path.join(root, "app", "env", "environment.ts"), "utf8"),
  )?.[1];
  if (flavor === undefined) {
    throw new Error("Could not read buildFlavor from app/env/environment.ts");
  }
  const { version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  fs.writeFileSync(path.join(outRoot, "bundle-build.json"), JSON.stringify({ flavor, version }, null, 2));
}

build().catch((e) => {
  // esbuild has already printed its own errors
  if (!Array.isArray(e.errors)) {
    console.error(e.message);
  }
  process.exit(1);
});
