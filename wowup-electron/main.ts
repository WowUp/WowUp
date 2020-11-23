import {
  app,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  Menu,
  MenuItem,
  MenuItemConstructorOptions,
  powerMonitor,
} from "electron";
import * as log from "electron-log";
import * as Store from "electron-store";
import * as os from "os";
import * as path from "path";
import * as url from "url";
import * as platform from "./platform";
import { initializeAppUpdateIpcHandlers, initializeAppUpdater } from "./app-updater";
import "./ipc-events";
import { initializeIpcHanders } from "./ipc-events";
import {
  COLLAPSE_TO_TRAY_PREFERENCE_KEY,
  CURRENT_THEME_KEY,
  DEFAULT_BG_COLOR,
  DEFAULT_LIGHT_BG_COLOR,
  USE_HARDWARE_ACCELERATION_PREFERENCE_KEY,
} from "./src/common/constants";
import { AppOptions } from "./src/common/wowup/app-options";
import { windowStateManager } from "./window-state";

const startedAt = Date.now();
const preferenceStore = new Store({ name: "preferences" });
const isPortable = !!process.env.PORTABLE_EXECUTABLE_DIR;

let appIsQuitting = false;
let win: BrowserWindow = null;

// APP MENU SETUP
const appMenuTemplate: Array<MenuItemConstructorOptions | MenuItem> = getAppMenu();

const appMenu = Menu.buildFromTemplate(appMenuTemplate);
Menu.setApplicationMenu(appMenu);

const LOG_PATH = path.join(app.getPath("userData"), "logs");
app.setAppLogsPath(LOG_PATH);
log.transports.file.resolvePath = (variables: log.PathVariables) => {
  return path.join(LOG_PATH, variables.fileName);
};
log.info("Main starting");

process.on("uncaughtException", (error) => {
  log.error("uncaughtException", error);
});

process.on("unhandledRejection", (error) => {
  log.error("unhandledRejection", error);
});

app.setAppUserModelId("io.wowup.jliddev");

if (preferenceStore.get(USE_HARDWARE_ACCELERATION_PREFERENCE_KEY) === "false") {
  log.info("Hardware acceleration disabled");
  app.disableHardwareAcceleration();
} else {
  log.info("Hardware acceleration enabled");
}

app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors");

const portableStr = isPortable ? " portable;" : "";
const USER_AGENT = `WowUp-Client/${app.getVersion()} (${os.type()}; ${os.release()}; ${os.arch()}; ${portableStr} +https://wowup.io)`;
log.info("USER_AGENT", USER_AGENT);

const argv = require("minimist")(process.argv.slice(1), {
  boolean: ["serve", "hidden"],
}) as AppOptions;

function canStartHidden() {
  return argv.hidden || app.getLoginItemSettings().wasOpenedAsHidden;
}

function createWindow(): BrowserWindow {
  const savedTheme = preferenceStore.get(CURRENT_THEME_KEY) as string;
  const backgroundColor = savedTheme && savedTheme.indexOf("light") !== -1 ? DEFAULT_LIGHT_BG_COLOR : DEFAULT_BG_COLOR;

  // Main object for managing window state
  // Initialize with a window name and default size
  const mainWindowManager = windowStateManager("main", {
    width: 900,
    height: 600,
  });

  const windowOptions: BrowserWindowConstructorOptions = {
    width: mainWindowManager.width,
    height: mainWindowManager.height,
    x: mainWindowManager.x,
    y: mainWindowManager.y,
    backgroundColor,
    title: "WowUp",
    titleBarStyle: "hidden",
    webPreferences: {
      // preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      allowRunningInsecureContent: argv.serve ? true : false,
      webSecurity: false,
      enableRemoteModule: true,
    },
    minWidth: 940,
    minHeight: 550,
    show: false,
  };

  if (platform.isWin || platform.isLinux) {
    windowOptions.frame = false;
  }

  // Attempt to fix the missing icon issue on Ubuntu
  if (platform.isLinux) {
    windowOptions.icon = path.join(__dirname, "assets", "wowup_logo_512np.png");
  }

  // Create the browser window.
  win = new BrowserWindow(windowOptions);
  initializeIpcHanders(win);
  initializeAppUpdater(win);
  initializeAppUpdateIpcHandlers(win);

  // Keep track of window state
  mainWindowManager.monitorState(win);

  win.webContents.userAgent = USER_AGENT;

  // See https://www.electronjs.org/docs/api/web-contents#event-render-process-gone
  win.webContents.on("render-process-gone", (evt, details) => {
    log.error("webContents render-process-gone");
    log.error(evt);
    log.error(details);
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

  if (platform.isMac) {
    win.on("close", (e) => {
      if (appIsQuitting || preferenceStore.get(COLLAPSE_TO_TRAY_PREFERENCE_KEY) !== "true") {
        return;
      }

      e.preventDefault();
      win.hide();
      app.dock.hide();
    });
  }

  win.once("closed", () => {
    win = null;
  });

  log.info(`Loading app URL: ${Date.now() - startedAt}ms`);
  if (argv.serve) {
    require("electron-reload")(__dirname, {
      electron: require(`${__dirname}/node_modules/electron`),
    });
    win.loadURL("http://localhost:4200");
  } else {
    win.loadURL(
      url.format({
        pathname: path.join(__dirname, "dist/index.html"),
        protocol: "file:",
        slashes: true,
      })
    );
  }

  return win;
}

try {
  // Adapted from https://github.com/electron/electron/blob/master/docs/api/app.md#apprequestsingleinstancelock
  const singleInstanceLock = app.requestSingleInstanceLock();
  if (!singleInstanceLock) {
    app.quit();
  } else {
    app.on("second-instance", () => {
      // Someone tried to run a second instance, we should focus our window.
      if (win) {
        if (win.isMinimized()) {
          win.restore();
        } else if (!win.isVisible() && !platform.isMac) {
          win.show();
        }
        win.focus();
      }
    });
  }

  app.allowRendererProcessReuse = false;

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  // Added 400 ms to fix the black background issue while using transparent window. More detais at https://github.com/electron/electron/issues/15947
  app.on("ready", () => {
    log.info(`App ready: ${Date.now() - startedAt}ms`);
    setTimeout(() => {
      createWindow();
    }, 400);
  });

  app.on("before-quit", () => {
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
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (platform.isMac) {
      app.dock.show();
      win?.show();
    }

    if (win === null) {
      createWindow();
    }
  });

  powerMonitor.on("resume", () => {
    log.info("powerMonitor resume");
  });

  powerMonitor.on("suspend", () => {
    log.info("powerMonitor suspend");
  });

  powerMonitor.on("lock-screen", () => {
    log.info("powerMonitor lock-screen");
  });

  powerMonitor.on("unlock-screen", () => {
    log.info("powerMonitor unlock-screen");
  });
} catch (e) {
  // Catch Error
  // throw e;
}

function getAppMenu(): Array<MenuItemConstructorOptions | MenuItem> {
  if (platform.isMac) {
    return [
      {
        label: app.name,
        submenu: [{ role: "quit" }],
      },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      {
        label: "View",
        submenu: [
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools", accelerator: "CommandOrControl+Shift+I" },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn", accelerator: "CommandOrControl+=" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
    ];
  } else if (platform.isWin) {
    return [
      {
        label: "View",
        submenu: [
          { role: "resetZoom" },
          { role: "toggleDevTools" },
          { role: "zoomIn", accelerator: "CommandOrControl+=" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
    ];
  } else if (platform.isLinux) {
    return [
      {
        label: app.name,
        submenu: [{ role: "quit" }],
      },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      {
        label: "View",
        submenu: [
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn", accelerator: "CommandOrControl+=" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
    ];
  }

  return [];
}
