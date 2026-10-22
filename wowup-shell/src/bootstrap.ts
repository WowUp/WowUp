import { app } from "electron";
import * as log from "electron-log/main";
import Module = require("module");
import { delimiter, join, resolve } from "path";

import { WOWUP_PROTOCOL_NAME, setAsDefaultProtocolClient } from "../contract/protocol-client";
import { SHELL_API_VERSION, setShell } from "../contract/shell-api";

// The signed shell's entry point. Only what has to happen before, or independently of, the app bundle
// belongs here; everything else lives in the bundle's main.ts. See wowup-electron/SHELL_BUNDLE_PLAN.md.
// The shell never imports app code (enforced in .eslintrc.js): the bundle can update without the shell, so
// the shell must not compile in a copy of code that may since have changed. The bundle is built in
// wowup-electron and loaded by runtime path.

const BUNDLE_DIR_ARG = "--bundle-dir=";

// LOGGING SETUP
// Override the default log path so they aren't a pain to find on Mac
const LOG_PATH = join(app.getPath("userData"), "logs");
app.setAppLogsPath(LOG_PATH);
log.initialize();
log.transports.file.resolvePathFn = (variables) => {
  return join(LOG_PATH, variables.fileName ?? "log-file.txt");
};

// Only allow one instance of the app to run at a time. The running instance gets a second-instance event,
// handled in main.ts, and focuses its window.
// Adapted from https://github.com/electron/electron/blob/master/docs/api/app.md#apprequestsingleinstancelock
if (!app.requestSingleInstanceLock()) {
  // app.quit() is async and does not stop this module from continuing, which let the losing instance
  // still build a full window (IPC handlers, updater, ads) only to have its load aborted by the quit.
  // Exit immediately instead. See https://github.com/WowUp/WowUp/issues/1379
  log.info("Another instance holds the single instance lock, exiting");
  app.exit(0);
} else {
  const shellRoot = app.getAppPath();
  // Before registering the protocol handler, which re-uses --bundle-dir once it's been made absolute
  const bundleRoot = getBundleRoot();
  useShellNodeModules(shellRoot);

  // WowUp Protocol Handler
  setAsDefaultProtocolClient(WOWUP_PROTOCOL_NAME);

  setShell({
    apiVersion: SHELL_API_VERSION,
    logPath: LOG_PATH,
    paths: {
      shellRoot,
      bundleRoot,
      nativeAddon: join(shellRoot, "build", "Release", "addon.node"),
    },
    markHealthy: () => {
      // Boot health tracking and rollback arrive with bundle loading
    },
  });

  // Loaded synchronously so the bundle's open-url and second-instance listeners are attached before
  // Electron can deliver either event. Required by runtime path so the shell build never pulls it in.
  require(join(bundleRoot, "main.js"));
}

/**
 * Packaged builds load the bundle the installer ships next to the app. Dev builds load the bundle folder
 * wowup-electron builds, which its scripts pass as --bundle-dir. That flag is only honoured unpackaged: an
 * installed app must never load code from a path given on the command line. Downloaded bundles arrive with
 * bundle loading.
 */
function getBundleRoot(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, "bundle");
  }

  const index = process.argv.findIndex((arg) => arg.startsWith(BUNDLE_DIR_ARG));
  if (index === -1) {
    throw new Error(`Start the unpackaged shell with ${BUNDLE_DIR_ARG}<wowup-electron/app-build/bundle>`);
  }

  // Made absolute in place, so anything that re-launches the app with these arguments (protocol
  // registration, electron-reload) still finds the bundle from another working directory
  const bundleRoot = resolve(process.argv[index].slice(BUNDLE_DIR_ARG.length));
  process.argv[index] = `${BUNDLE_DIR_ARG}${bundleRoot}`;
  return bundleRoot;
}

/**
 * Lets the bundle require its externals (electron-log, win-ca, ...) from the shell's node_modules. Node only
 * looks in node_modules folders above the requiring file, and a bundle outside the install directory has
 * none, so the shell's are added to the global search paths. NODE_PATH stays set: renderer processes
 * inherit it, and the bundle's preload needs the same externals.
 */
function useShellNodeModules(shellRoot: string): void {
  process.env.NODE_PATH = [join(shellRoot, "node_modules"), process.env.NODE_PATH].filter(Boolean).join(delimiter);
  (Module as unknown as { _initPaths: () => void })._initPaths();
}
