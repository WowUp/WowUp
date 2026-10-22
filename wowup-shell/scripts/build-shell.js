// Builds the shell's entry point, src/bootstrap.ts, into dist/bootstrap.js (build/ belongs to node-gyp, for
// the native addon). The app bundle is built separately in wowup-electron and loaded by runtime path, never
// compiled in. See wowup-electron/SHELL_BUNDLE_PLAN.md. Type checking is done with `tsc -p tsconfig.json`.
const esbuild = require("esbuild");
const fs = require("node:fs");
const path = require("path");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "dist");

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
    logLevel: "warning",
  });
}

build().catch(() => {
  // esbuild has already printed the errors
  process.exit(1);
});
