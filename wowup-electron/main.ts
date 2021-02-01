import { app, BrowserWindow, BrowserWindowConstructorOptions, powerMonitor } from "electron";
import * as log from "electron-log";
import * as Store from "electron-store";
import { type as osType, release as osRelease, arch as osArch } from "os";
import { join } from "path";
import { format as urlFormat } from "url";
import { inspect } from "util";
import * as platform from "./platform";
import { initializeAppUpdateIpcHandlers, initializeAppUpdater } from "./app-updater";
import { initializeIpcHandlers } from "./ipc-events";
import {
  COLLAPSE_TO_TRAY_PREFERENCE_KEY,
  CURRENT_THEME_KEY,
  DEFAULT_BG_COLOR,
  DEFAULT_LIGHT_BG_COLOR,
  IPC_POWER_MONITOR_LOCK,
  IPC_POWER_MONITOR_RESUME,
  IPC_POWER_MONITOR_SUSPEND,
  IPC_POWER_MONITOR_UNLOCK,
  IPC_WINDOW_ENTER_FULLSCREEN,
  IPC_WINDOW_LEAVE_FULLSCREEN,
  IPC_WINDOW_MAXIMIZED,
  IPC_WINDOW_MINIMIZED,
  IPC_WINDOW_UNMAXIMIZED,
  USE_HARDWARE_ACCELERATION_PREFERENCE_KEY,
  WINDOW_DEFAULT_HEIGHT,
  WINDOW_DEFAULT_WIDTH,
  WINDOW_MIN_HEIGHT,
  WINDOW_MIN_WIDTH,
  WOWUP_LOGO_FILENAME,
} from "./src/common/constants";
import { AppOptions } from "./src/common/wowup/app-options";
import { windowStateManager } from "./window-state";
import { createAppMenu } from "./app-menu";
import { MainChannels } from "./src/common/wowup";

// LOGGING SETUP
// Override the default log path so they aren't a pain to find on Mac
const LOG_PATH = join(app.getPath("userData"), "logs");
app.setAppLogsPath(LOG_PATH);
log.transports.file.resolvePath = (variables: log.PathVariables) => {
  return join(LOG_PATH, variables.fileName);
};
log.info("Main starting");

// ERROR HANDLING SETUP
process.on("uncaughtException", (error) => {
  log.error("uncaughtException", error);
});

process.on("unhandledRejection", (error) => {
  log.error("unhandledRejection", error);
});

// VARIABLES
const startedAt = Date.now();
const preferenceStore = new Store({ name: "preferences" });
const argv = require("minimist")(process.argv.slice(1), {
  boolean: ["serve", "hidden"],
}) as AppOptions;
const isPortable = !!process.env.PORTABLE_EXECUTABLE_DIR;
const USER_AGENT = getUserAgent();
log.info("USER_AGENT", USER_AGENT);

let appIsQuitting = false;
let win: BrowserWindow = null;

// APP MENU SETUP
createAppMenu(win);

// Set the app ID so that our notifications work correctly on Windows
app.setAppUserModelId("io.wowup.jliddev");

// HARDWARE ACCELERATION SETUP
if (preferenceStore.get(USE_HARDWARE_ACCELERATION_PREFERENCE_KEY) === "false") {
  log.info("Hardware acceleration disabled");
  app.disableHardwareAcceleration();
} else {
  log.info("Hardware acceleration enabled");
}

app.allowRendererProcessReuse = false;

// Some servers don't supply good CORS headers for us, so we ignore them.
app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors");

// Only allow one instance of the app to run at a time, focus running window if user opens a 2nd time
// Adapted from https://github.com/electron/electron/blob/master/docs/api/app.md#apprequestsingleinstancelock
const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    // Someone tried to run a second instance, we should focus our window.
    if (!win) {
      log.warn("Second instance launched, but no window found");
      return;
    }

    if (win.isMinimized()) {
      win.restore();
    } else if (!win.isVisible() && !platform.isMac) {
      win.show();
    }

    win.focus();
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// Added 400 ms to fix the black background issue while using transparent window. More details at https://github.com/electron/electron/issues/15947
if (app.isReady()) {
  log.info(`App already ready: ${Date.now() - startedAt}ms`);
} else {
  app.once("ready", () => {
    log.info(`App ready: ${Date.now() - startedAt}ms`);
    // setTimeout(() => {
    createWindow();
    // }, 400);
  });
}

app.on("before-quit", () => {
  win = null;
  appIsQuitting = true;
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
  if (details.reason === "killed") {
    app.quit();
  }
});

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

let lastCrash = 0;

function createWindow(): BrowserWindow {
  if (win) {
    win.destroy();
  }

  // Main object for managing window state
  // Initialize with a window name and default size
  const mainWindowManager = windowStateManager("main", {
    width: WINDOW_DEFAULT_WIDTH,
    height: WINDOW_DEFAULT_HEIGHT,
  });

  const windowOptions: BrowserWindowConstructorOptions = {
    width: mainWindowManager.width,
    height: mainWindowManager.height,
    x: mainWindowManager.x,
    y: mainWindowManager.y,
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    center: mainWindowManager.centered === true,
    transparent: false,
    resizable: true,
    backgroundColor: getBackgroundColor(),
    title: "WowUp",
    titleBarStyle: "hidden",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      nodeIntegration: true,
      allowRunningInsecureContent: argv.serve,
      webSecurity: false,
      nativeWindowOpen: true,
      enableRemoteModule: true, // This is only required for electron store https://github.com/sindresorhus/electron-store/issues/152
    },
    show: false,
  };

  if (platform.isWin || platform.isLinux) {
    windowOptions.frame = false;
  }

  // Attempt to fix the missing icon issue on Ubuntu
  if (platform.isLinux) {
    windowOptions.icon = join(__dirname, "assets", WOWUP_LOGO_FILENAME);
  }

  // Create the browser window.
  win = new BrowserWindow(windowOptions);

  initializeIpcHandlers(win);
  initializeAppUpdater(win);
  initializeAppUpdateIpcHandlers(win);

  // Keep track of window state
  mainWindowManager.monitorState(win);

  win.webContents.userAgent = USER_AGENT;

  win.webContents.on("zoom-changed", (evt, zoomDirection) => {
    sendEventToContents(win, "zoom-changed", zoomDirection);
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
    win.show();
  });

  win.once("show", () => {
    if (mainWindowManager.isFullScreen) {
      win.setFullScreen(true);
    } else if (mainWindowManager.isMaximized) {
      win.maximize();
    }
  });

  win.on("close", (e) => {
    if (appIsQuitting || preferenceStore.get(COLLAPSE_TO_TRAY_PREFERENCE_KEY) !== "true") {
      return;
    }
    e.preventDefault();
    win.hide();
    win.setSkipTaskbar(true);

    if (platform.isMac) {
      app.dock.hide();
    }
  });

  win.once("closed", () => {
    win = null;
  });

  win.on("maximize", () => {
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
    loadMainUrl(win).catch((e) => log.error(e));
  });

  log.info(`Loading app URL: ${Date.now() - startedAt}ms`);
  if (argv.serve) {
    require("electron-reload")(__dirname, {
      electron: require(`${__dirname}/node_modules/electron`),
    });
    win.loadURL("http://localhost:4200").catch((e) => log.error(e));
  } else {
    loadMainUrl(win).catch((e) => log.error(e));
  }

  return win;
}

function loadMainUrl(window: BrowserWindow) {
  return window?.loadURL(
    urlFormat({
      pathname: join(__dirname, "dist/index.html"),
      protocol: "file:",
      slashes: true,
    })
  );
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

function sendEventToContents(window: BrowserWindow, event: MainChannels, ...args: any[]) {
  window?.webContents?.send(event, args);
}

function getBackgroundColor() {
  const savedTheme = preferenceStore.get(CURRENT_THEME_KEY) as string;
  return savedTheme && savedTheme.indexOf("light") !== -1 ? DEFAULT_LIGHT_BG_COLOR : DEFAULT_BG_COLOR;
}

function canStartHidden() {
  return argv.hidden || app.getLoginItemSettings().wasOpenedAsHidden;
}

function getUserAgent() {
  const portableStr = isPortable ? " portable;" : "";
  return `WowUp-Client/${app.getVersion()} (${osType()}; ${osRelease()}; ${osArch()}; ${portableStr} +https://wowup.io)`;
}
