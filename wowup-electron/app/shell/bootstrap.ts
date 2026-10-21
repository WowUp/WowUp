import { app } from "electron";
import * as log from "electron-log/main";
import Module = require("module");
import { delimiter, join } from "path";

import { WOWUP_PROTOCOL_NAME, setAsDefaultProtocolClient } from "./protocol-client";
import { SHELL_API_VERSION, setShell } from "./shell-api";

// The signed shell's entry point. Only what has to happen before, or independently of, the app bundle
// belongs here; everything else lives in main.ts. See SHELL_BUNDLE_PLAN.md.
// Nothing in app/shell may import app code (enforced in .eslintrc.js): the bundle can update without the
// shell, so the shell must not compile in a copy of code that may since have changed. The shell and the
// bundle are built separately by scripts/build-main.js.

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
  // WowUp Protocol Handler
  setAsDefaultProtocolClient(WOWUP_PROTOCOL_NAME);

  // Packaged builds load the bundle the installer ships next to the app; dev builds load the folder that
  // scripts/build-main.js and ng build produce. Downloaded bundles arrive with bundle loading.
  const shellRoot = app.getAppPath();
  const bundleRoot = app.isPackaged ? join(process.resourcesPath, "bundle") : join(shellRoot, "app-build", "bundle");
  useShellNodeModules(shellRoot);

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
 * Lets the bundle require its externals (electron-log, win-ca, ...) from the shell's node_modules. Node only
 * looks in node_modules folders above the requiring file, and a bundle outside the install directory has
 * none, so the shell's are added to the global search paths. NODE_PATH stays set: renderer processes
 * inherit it, and the bundle's preload needs the same externals.
 */
function useShellNodeModules(shellRoot: string): void {
  process.env.NODE_PATH = [join(shellRoot, "node_modules"), process.env.NODE_PATH].filter(Boolean).join(delimiter);
  (Module as unknown as { _initPaths: () => void })._initPaths();
}
