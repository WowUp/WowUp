// Builds the main process as two separately bundled pieces, see SHELL_BUNDLE_PLAN.md:
//  - the shell:  app/shell/bootstrap.ts         -> app-build/shell/bootstrap.js
//  - the bundle: app/main.ts and app/preload.ts -> app-build/bundle/{main,preload}.js
// Neither includes the other: the bootstrap loads the bundle by runtime path. Type checking is done
// separately with `tsc -p tsconfig.serve.json`.
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
  // Clear out anything left from earlier builds, including the old per-file tsc output in app-build/app
  fs.rmSync(outRoot, { recursive: true, force: true });

  await Promise.all([
    esbuild.build({ ...common, entryPoints: ["app/shell/bootstrap.ts"], outdir: path.join(outRoot, "shell") }),
    esbuild.build({ ...common, entryPoints: ["app/main.ts", "app/preload.ts"], outdir: path.join(outRoot, "bundle") }),
  ]);
}

build().catch(() => {
  // esbuild has already printed the errors
  process.exit(1);
});
