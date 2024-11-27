import { dialog } from "electron";
import { app, BrowserWindow, BrowserWindowConstructorOptions, powerMonitor } from "electron";
import * as log from "electron-log/main";
import { find } from "lodash";
import * as minimist from "minimist";
import { arch as osArch, release as osRelease, type as osType } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { inspect } from "util";

import {
  APP_PROTOCOL_NAME,
  APP_USER_MODEL_ID,
  APP_USER_MODEL_ID_CF,
  COLLAPSE_TO_TRAY_PREFERENCE_KEY,
  CURRENT_THEME_KEY,
  DEFAULT_BG_COLOR,
  DEFAULT_LIGHT_BG_COLOR,
  IPC_CUSTOM_PROTOCOL_RECEIVED,
  IPC_POWER_MONITOR_LOCK,
  IPC_POWER_MONITOR_RESUME,
  IPC_POWER_MONITOR_SUSPEND,
  IPC_POWER_MONITOR_UNLOCK,
  IPC_PUSH_NOTIFICATION,
  IPC_WINDOW_ENTER_FULLSCREEN,
  IPC_WINDOW_LEAVE_FULLSCREEN,
  IPC_WINDOW_MAXIMIZED,
  IPC_WINDOW_MINIMIZED,
  IPC_WINDOW_UNMAXIMIZED,
  START_MINIMIZED_PREFERENCE_KEY,
  START_WITH_SYSTEM_PREFERENCE_KEY,
  USE_HARDWARE_ACCELERATION_PREFERENCE_KEY,
  WINDOW_DEFAULT_HEIGHT,
  WINDOW_DEFAULT_WIDTH,
  WINDOW_MIN_HEIGHT,
  WINDOW_MIN_WIDTH,
  WOWUP_LOGO_FILENAME,
  WOWUP_LOGO_FILENAME_CF,
} from "../src/common/constants";
import { AppOptions } from "../src/common/wowup/models";
import { createAppMenu } from "./app-menu";
import { appUpdater } from "./app-updater";
import { wagoHandler } from "./wago-handler";
import { initializeIpcHandlers, setPendingOpenUrl } from "./ipc-events";
import * as platform from "./platform";
import { initializeDefaultPreferences } from "./preferences";
import { PUSH_NOTIFICATION_EVENT, pushEvents } from "./push";
import { getPreferenceStore, initializeStoreIpcHandlers } from "./stores";
import * as windowState from "./window-state";
import { validateGpuCache } from "./utils/gpu-cache-buster";
import { AppEnv } from "./env/environment";

// LOGGING SETUP
// Override the default log path so they aren't a pain to find on Mac
const LOG_PATH = join(app.getPath("userData"), "logs");
app.setAppLogsPath(LOG_PATH);
log.initialize();
log.transports.file.resolvePathFn = (variables) => {
  return join(LOG_PATH, variables.fileName ?? "log-file.txt");
};
log.info("Main starting");
log.info(`Electron: ${process.versions.electron}`);
log.info(`BinaryPath: ${app.getPath("exe")}`);
log.info("ExecPath", process.execPath);
log.info("Args", process.argv);
log.info(`Log path: ${LOG_PATH}`);

// ERROR HANDLING SETUP
process.on("uncaughtException", (error) => {
  log.error("uncaughtException", error);
});

process.on("unhandledRejection", (error) => {
  log.error("unhandledRejection", error);
});

// WINDOWS CERTS
if (platform.isWin) {
  require("win-ca");
}

validateGpuCache(app);

// VARIABLES
const startedAt = Date.now();
const argv = minimist(process.argv.slice(1), {
  boolean: ["serve", "hidden"],
}) as AppOptions;
log.info("ARGV", argv);
const isPortable = !!process.env.PORTABLE_EXECUTABLE_DIR;
const USER_AGENT = getUserAgent();
log.info("USER_AGENT", USER_AGENT);

let appIsQuitting = false;
let win: BrowserWindow | null = null;
let loadFailCount = 0;

initializeDefaultPreferences();

// Only allow one instance of the app to run at a time, focus running window if user opens a 2nd time
// Adapted from https://github.com/electron/electron/blob/master/docs/api/app.md#apprequestsingleinstancelock
const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (evt, args) => {
    log.info(`Second instance detected`, args);
    // Someone tried to run a second instance, we should focus our window.
    if (!win) {
      log.warn("Second instance launched, but no window found");
      return;
    }

    windowState.restoreWindow(win);

    win.focus();

    // Find the first protocol arg if any exist
    const customProtocol = find(args, (arg) => isProtocol(arg));
    if (customProtocol) {
      log.info(`Custom protocol detected: ${customProtocol}`);
      // If we did get a custom protocol notify the app
      win.webContents.send(IPC_CUSTOM_PROTOCOL_RECEIVED, customProtocol);
    } else {
      log.info(`No custom protocol detected`);
    }
  });
}

// APP MENU SETUP
createAppMenu(win);

// WowUp Protocol Handler
app.setAsDefaultProtocolClient(APP_PROTOCOL_NAME);

// Set the app ID so that our notifications work correctly on Windows
app.setAppUserModelId(AppEnv.buildFlavor === "ow" ? APP_USER_MODEL_ID_CF : APP_USER_MODEL_ID);

// HARDWARE ACCELERATION SETUP
if (getPreferenceStore().get(USE_HARDWARE_ACCELERATION_PREFERENCE_KEY) === "false") {
  log.info("Hardware acceleration disabled");
  app.disableHardwareAcceleration();
} else {
  log.info("Hardware acceleration enabled");
}

// Some servers don't supply good CORS headers for us, so we ignore them.
app.commandLine.appendSwitch("disable-features", "HardwareMediaKeyHandling,OutOfBlinkCors");

function isProtocol(arg: string) {
  return getProtocol(arg) != null;
}

function getProtocol(arg: string) {
  const match = /^([a-z][a-z0-9+\-.]*):/.exec(arg);
  return match !== null && match.length > 1 ? match[1] : null;
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// Added 400 ms to fix the black background issue while using transparent window. More details at https://github.com/electron/electron/issues/15947
app
  .whenReady()
  .then(() => {
    powerMonitor.on("resume", () => {
      log.info("powerMonitor resume");
      win?.webContents?.send(IPC_POWER_MONITOR_RESUME);
    });

    powerMonitor.on("suspend", () => {
      log.info("powerMonitor suspend");
      win?.webContents?.send(IPC_POWER_MONITOR_SUSPEND);
    });

    powerMonitor.on("lock-screen", () => {
      log.info("powerMonitor lock-screen");
      win?.webContents?.send(IPC_POWER_MONITOR_LOCK);
    });

    powerMonitor.on("unlock-screen", () => {
      log.info("powerMonitor unlock-screen");
      win?.webContents?.send(IPC_POWER_MONITOR_UNLOCK);
    });

    log.info(`App ready: ${Date.now() - startedAt}ms`);
    createWindow();
  })
  .catch((e) => {
    log.error("whenready failed", e);
  });

app.on("before-quit", () => {
  windowState.saveWindowConfig(win);
  win = null;
  appIsQuitting = true;
  appUpdater?.dispose();
});

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  // if (process.platform !== "darwin") {
  app.quit();
  // }
});

app.on("activate", () => {
  void onActivate();
});

app.on("child-process-gone", (e, details) => {
  log.warn("child-process-gone", inspect(details));
  if (details.reason === "crashed") {
    onChildProcessCrashed(details);
  } else if (details.reason === "killed") {
    app.quit();
  }
});

// See https://www.electronjs.org/docs/api/app#event-open-url-macos
if (platform.isMac) {
  app.on("open-url", (evt, url) => {
    log.info(`Open url received ${url}`);

    // If we did get a custom protocol notify the app
    if (isProtocol(url)) {
      evt.preventDefault();
      log.info(`Custom protocol detected: ${url}`);
      win?.webContents.send(IPC_CUSTOM_PROTOCOL_RECEIVED, url);
      setPendingOpenUrl(url);
    }
  });
}

let lastCrash = 0;

const crashMap = new Map<string, number>();
const exitOnCrashServices = ["network.mojom.NetworkService"];
/** If a particular child process crashes too many times, notify the user and exit the app to attempt preventing softlock of system */
function onChildProcessCrashed(details: Electron.Details) {
  if (typeof details.serviceName !== "string") {
    return;
  }
  if (!exitOnCrashServices.includes(details.serviceName)) {
    return;
  }

  let ct = crashMap.get(details.serviceName) ?? 0;
  ct += 1;
  crashMap.set(details.serviceName, ct);

  if (ct >= 3) {
    dialog.showErrorBox(
      "Child Process Failure",
      `Child process ${details.serviceName} has crashed too many times, app will now exit`,
    );
    app.quit();
  }
}

function createWindow(): BrowserWindow {
  if (win) {
    win.destroy();
  }

  // Main object for managing window state
  // Initialize with a window name and default size

  const windowOptions: BrowserWindowConstructorOptions = {
    width: WINDOW_DEFAULT_WIDTH,
    height: WINDOW_DEFAULT_HEIGHT,
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    transparent: false,
    resizable: true,
    backgroundColor: getBackgroundColor(),
    title: "WowUp" + AppEnv.buildFlavor === "ow" ? " CF" : "",
    titleBarStyle: "hidden",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      nodeIntegration: true,
      contextIsolation: false,
      allowRunningInsecureContent: argv.serve,
      webSecurity: false,
      additionalArguments: [
        `--log-path=${LOG_PATH}`,
        `--user-data-path=${app.getPath("userData")}`,
        `--base-bg-color=${getBackgroundColor()}`,
      ],
      webviewTag: true,
    },
    show: false,
  };

  if (platform.isWin || platform.isLinux) {
    windowOptions.frame = false;
  }

  // Attempt to fix the missing icon issue on Ubuntu
  if (platform.isLinux) {
    windowOptions.icon = join(
      __dirname,
      "assets",
      AppEnv.buildFlavor === "ow" ? WOWUP_LOGO_FILENAME_CF : WOWUP_LOGO_FILENAME,
    );
  }

  windowState.applyWindowBoundsToConfig(windowOptions);

  // Create the browser window.
  win = new BrowserWindow(windowOptions);

  windowState.restoreMainWindowBounds(win);

  if (windowState.wasMaximized()) {
    win.maximize();
  }

  appUpdater.init(win);

  initializeIpcHandlers(win);
  initializeStoreIpcHandlers();

  if (AppEnv.buildFlavor === "wago") {
    wagoHandler.initialize(win);
  }

  pushEvents.on(PUSH_NOTIFICATION_EVENT, (data) => {
    win?.webContents.send(IPC_PUSH_NOTIFICATION, data);
  });

  win.on("blur", () => {
    win?.webContents.send("blur");
  });

  win.on("focus", () => {
    win?.webContents.send("focus");
  });

  win.webContents.userAgent = USER_AGENT;
  win.webContents.setAudioMuted(true);

  win.webContents.on("will-attach-webview", (evt, webPreferences) => {
    log.debug("will-attach-webview");

    webPreferences.additionalArguments = [`--log-path=${LOG_PATH}`];
    webPreferences.contextIsolation = true;
    webPreferences.plugins = false;
    webPreferences.webgl = false;
  });

  win.webContents.on("did-attach-webview", (evt, webContents) => {
    webContents.session.setUserAgent(webContents.userAgent);

    webContents.on("preload-error", (evt, path, e) => {
      log.error("[webview] preload-error", e.message);
    });

    webContents.on("did-fail-provisional-load", (evt) => {
      log.error("[webview] did-fail-provisional-load", evt);
    });

    webContents.session.setPermissionRequestHandler((contents, permission, callback) => {
      log.warn("[webview] setPermissionRequestHandler", permission);
      return callback(false);
    });

    webContents.session.setPermissionCheckHandler((contents, permission, origin) => {
      if (["background-sync"].includes(permission)) {
        return true;
      }

      log.warn("[webview] setPermissionCheckHandler", permission, origin);
      return false;
    });

    if (AppEnv.buildFlavor === "wago") {
      webContents.on("did-start-navigation", (evt, url) => {
        if (url === "https://addons.wago.io/wowup_ad") {
          log.debug("[webview] did-start-navigation", url);
          wagoHandler.initializeWebContents(webContents);
        }
      });
    }

    // webview allowpopups must be enabled for any link to work
    // https://www.electronjs.org/docs/latest/api/webview-tag#allowpopups
    webContents.setWindowOpenHandler((details) => {
      log.debug("[webview] setWindowOpenHandler");
      win?.webContents.send("webview-new-window", details); // forward this new window to the app for processing
      return { action: "deny" };
    });
  });

  win.webContents.on("zoom-changed", (zoomDirection) => {
    win?.webContents?.send("zoom-changed", zoomDirection);
  });

  // See https://www.electronjs.org/docs/api/web-contents#event-render-process-gone
  win.webContents.on("render-process-gone", (evt, details) => {
    log.error("webContents render-process-gone");
    log.error(details);

    // If something killed the process, quit
    if (details.reason === "killed") {
      win?.destroy();
      app.quit();
      return;
    }

    // If process crashes too quickly, kill the app
    const crashTime = Date.now();
    if (crashTime - lastCrash < 5000) {
      log.error("Crash loop detected");
      win?.destroy();
      app.quit();
      return;
    }

    lastCrash = crashTime;
    log.info("Restarting main window");
  });

  // See https://www.electronjs.org/docs/api/web-contents#event-unresponsive
  win.webContents.on("unresponsive", () => {
    log.error("webContents unresponsive");
  });

  // See https://www.electronjs.org/docs/api/web-contents#event-responsive
  win.webContents.on("responsive", () => {
    log.error("webContents responsive");
  });

  win.once("ready-to-show", () => {
    if (canStartHidden()) {
      return;
    }

    win?.webContents.session.setPermissionRequestHandler((contents, permission, callback) => {
      log.warn("win setPermissionRequestHandler", permission);
      return callback(false);
    });

    win?.webContents.session.setPermissionCheckHandler((contents, permission, origin) => {
      log.warn("win setPermissionCheckHandler", permission, origin);
      return false;
    });

    win?.show();
  });

  win.once("show", () => {
    // win.webContents.openDevTools();

    if (windowState.wasFullScreen()) {
      win?.setFullScreen(true);
    }

    appUpdater.checkForUpdates().catch((e) => console.error(e));
  });

  if (platform.isLinux || platform.isWin) {
    win.on("close", () => {
      if (win === null) {
        return;
      }

      windowState.saveWindowConfig(win);
    });
  }

  win.on("close", (e) => {
    if (appIsQuitting || getPreferenceStore().get(COLLAPSE_TO_TRAY_PREFERENCE_KEY) !== "true") {
      pushEvents.removeAllListeners(PUSH_NOTIFICATION_EVENT);
      return;
    }
    e.preventDefault();
    win?.hide();
    win?.setSkipTaskbar(true);

    if (platform.isMac) {
      app.setBadgeCount(0);
      app.dock.hide();
    }
  });

  win.once("closed", () => {
    win = null;
  });

  win.on("maximize", () => {
    windowState.saveWindowConfig(win);
    win?.webContents?.send(IPC_WINDOW_MAXIMIZED);
  });

  win.on("unmaximize", () => {
    win?.webContents?.send(IPC_WINDOW_UNMAXIMIZED);
  });

  win.on("minimize", () => {
    win?.webContents?.send(IPC_WINDOW_MINIMIZED);
  });

  win.on("enter-full-screen", () => {
    win?.webContents?.send(IPC_WINDOW_ENTER_FULLSCREEN);
  });

  win.on("leave-full-screen", () => {
    win?.webContents?.send(IPC_WINDOW_LEAVE_FULLSCREEN);
  });

  win.webContents.on("did-fail-load", () => {
    log.info("did-fail-load");
    if (loadFailCount < 5) {
      loadFailCount += 1;
      loadMainUrl(win).catch((e) => log.error(e));
    } else {
      log.error(`Failed to load too many times, exiting`);
      app.quit();
    }
  });

  log.info(`Loading app URL: ${Date.now() - startedAt}ms`);
  if (argv.serve) {
    require("electron-reload")(__dirname, {
      electron: require(join(__dirname, "..", "node_modules", "electron")),
    });
    win.loadURL("http://localhost:4200").catch((e) => log.error(e));
  } else {
    loadMainUrl(win).catch((e) => log.error(e));
  }

  return win;
}

async function loadMainUrl(window: BrowserWindow | null): Promise<void> {
  if (window === null) {
    return;
  }

  const url = pathToFileURL(join(__dirname, "..", "dist", "index.html"));
  return await window?.loadURL(url.toString());
}

async function onActivate() {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (platform.isMac) {
    await app.dock.show();
    win?.show();
  }

  if (win === null) {
    createWindow();
  }
}

function getBackgroundColor() {
  const savedTheme = getPreferenceStore().get(CURRENT_THEME_KEY) as string | undefined;
  return savedTheme && savedTheme.indexOf("light") !== -1 ? DEFAULT_LIGHT_BG_COLOR : DEFAULT_BG_COLOR;
}

function canStartHidden() {
  const prefStore = getPreferenceStore();
  const systemStart = prefStore?.get(START_WITH_SYSTEM_PREFERENCE_KEY) as string | undefined;
  const startMin = prefStore?.get(START_MINIMIZED_PREFERENCE_KEY) as string | undefined;

  console.log(`START_WITH_SYSTEM_PREFERENCE_KEY: ${systemStart}`);
  console.log(`START_MINIMIZED_PREFERENCE_KEY: ${startMin}`);

  const loginItems = app.getLoginItemSettings();
  if (Array.isArray(loginItems?.launchItems)) {
    loginItems?.launchItems.forEach((li) => {
      console.log(`launchItem: ${li.name} args -> ${li.args.join(",")}`);
    });
  }
  return argv.hidden || loginItems.wasOpenedAsHidden;
}

function getUserAgent() {
  const portableStr = isPortable ? " portable;" : "";
  return `WowUp-Client/${app.getVersion()} (${osType()}; ${osRelease()}; ${osArch()}; ${AppEnv.buildFlavor === "ow" ? "CF;" : ""} ${portableStr} +https://wowup.io)`;
}
