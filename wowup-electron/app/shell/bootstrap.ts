import { app } from "electron";
import * as log from "electron-log/main";
import { join } from "path";

import { APP_PROTOCOL_NAME } from "../../src/common/constants";
import { setAsDefaultProtocolClient } from "../utils/protocol-client";
import { SHELL_API_VERSION, setShell } from "./shell-api";

// The signed shell's entry point. Only what has to happen before, or independently of, the app bundle
// belongs here; everything else lives in main.ts. See SHELL_BUNDLE_PLAN.md.

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
  setAsDefaultProtocolClient(APP_PROTOCOL_NAME);

  setShell({
    apiVersion: SHELL_API_VERSION,
    logPath: LOG_PATH,
    markHealthy: () => {
      // Boot health tracking and rollback arrive with bundle loading
    },
  });

  // Loaded synchronously so the bundle's open-url and second-instance listeners are attached before
  // Electron can deliver either event.
  require("../main");
}
