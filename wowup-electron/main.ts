import {
  app,
  BrowserWindow,
  screen,
  BrowserWindowConstructorOptions,
  Tray,
  Menu,
  nativeImage,
  MenuItem,
  MenuItemConstructorOptions,
  ipcMain,
} from "electron";
import * as path from "path";
import * as url from "url";
import { release, arch } from "os";
import * as electronDl from "electron-dl";
import "./ipc-events";
import * as log from "electron-log";
import * as Store from "electron-store";
import { WindowState } from "./src/common/models/window-state";
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { IpcHandler } from "./ipc-events";
import {
  COLLAPSE_TO_TRAY_PREFERENCE_KEY,
  USE_HARDWARE_ACCELERATION_PREFERENCE_KEY,
} from "./src/common/constants";
import { AppUpdater } from "./app-updater";

const isMac = process.platform === "darwin";
const isWin = process.platform === "win32";
const isLinux = process.platform === "linux";
const preferenceStore = new Store({ name: "preferences" });

let appIsQuitting = false;
let win: BrowserWindow = null;
let tray: Tray = null;
let ipcHandler: IpcHandler;
let appUpdater: AppUpdater;

// APP MENU SETUP
const appMenuTemplate: Array<
  MenuItemConstructorOptions | MenuItem
> = getAppMenu();

const appMenu = Menu.buildFromTemplate(appMenuTemplate);
Menu.setApplicationMenu(appMenu);

const LOG_PATH = path.join(app.getPath("userData"), "logs");
app.setAppLogsPath(LOG_PATH);
log.transports.file.resolvePath = (
  variables: log.PathVariables,
  _message?: log.LogMessage
) => {
  return path.join(LOG_PATH, variables.fileName);
};
log.info("Main starting");

app.setAppUserModelId("io.wowup.jliddev");

if (preferenceStore.get(USE_HARDWARE_ACCELERATION_PREFERENCE_KEY) === "false") {
  log.info("Hardware acceleration disabled");
  app.disableHardwareAcceleration();
} else {
  log.info("Hardware acceleration enabled");
}

app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors");
electronDl();

const USER_AGENT = `WowUp-Client/${app.getVersion()} (${release()}; ${arch()}; +https://wowup.io)`;
log.info("USER_AGENT", USER_AGENT);

const args = process.argv.slice(1),
  serve = args.some((val) => val === "--serve");

function createTray() {
  const trayIconPath = path.join(__dirname, "assets", "wowup_logo_512np.png");
  const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 16 });

  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: app.name, type: "normal", icon: icon, enabled: false },
    {
      label: "Show",
      click: () => {
        win.show();

        if (isMac) {
          app.dock.show();
        }
      },
    },
    { role: "quit" },
  ]);

  if (isWin) {
    tray.on("click", () => {
      win.show();
    });
  }

  tray.setToolTip("WowUp");
  tray.setContextMenu(contextMenu);
}

function windowStateManager(
  windowName: string,
  { width, height }: { width: number; height: number }
) {
  let window: BrowserWindow;
  let windowState: WindowState;
  const saveState$ = new Subject<void>();

  function setState() {
    let setDefaults = false;
    windowState = preferenceStore.get(
      `${windowName}-window-state`
    ) as WindowState;

    if (!windowState) {
      setDefaults = true;
    } else {
      log.info("found window state:", windowState);

      const valid = screen.getAllDisplays().some((display) => {
        return (
          windowState.x >= display.bounds.x &&
          windowState.y >= display.bounds.y &&
          windowState.x + windowState.width <=
            display.bounds.x + display.bounds.width &&
          windowState.y + windowState.height <=
            display.bounds.y + display.bounds.height
        );
      });

      if (!valid) {
        log.info("reset window state, bounds are outside displays");
        setDefaults = true;
      }
    }

    if (setDefaults) {
      log.info("setting window defaults");
      windowState = <WindowState>{ width, height };
    }
  }

  function saveState() {
    log.info("saving window state");
    if (!window.isMaximized() && !window.isFullScreen()) {
      windowState = { ...windowState, ...window.getBounds() };
    }
    windowState.isMaximized = window.isMaximized();
    windowState.isFullScreen = window.isFullScreen();
    preferenceStore.set(`${windowName}-window-state`, windowState);
  }

  function monitorState(win: BrowserWindow) {
    window = win;

    win.on("close", saveState);
    win.on("resize", () => saveState$.next());
    win.on("move", () => saveState$.next());
    win.on("closed", () => saveState$.unsubscribe());
  }

  saveState$.pipe(debounceTime(500)).subscribe(() => saveState());

  setState();

  return {
    ...windowState,
    monitorState,
  };
}

function createWindow(): BrowserWindow {
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
    backgroundColor: "#444444",
    title: "WowUp",
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      allowRunningInsecureContent: serve ? true : false,
      webSecurity: false,
      enableRemoteModule: true,
    },
    minWidth: 900,
    minHeight: 550,
    show: false,
  };

  if (isWin) {
    windowOptions.frame = false;
  }

  // Create the browser window.
  win = new BrowserWindow(windowOptions);
  ipcHandler = new IpcHandler(win);
  appUpdater = new AppUpdater(win);

  // Keep track of window state
  mainWindowManager.monitorState(win);

  win.webContents.userAgent = USER_AGENT;

  win.once("ready-to-show", () => {
    var startMinimized = (process.argv || []).indexOf('--hidden') !== -1;
    if (!startMinimized)
      win.show();
  });

  win.once("show", () => {
    if (mainWindowManager.isFullScreen) {
      win.setFullScreen(true);
    } else if (mainWindowManager.isMaximized) {
      win.maximize();
    }
  });

  if (isMac) {
    win.on("close", (e) => {
      if (appIsQuitting) {
        return;
      }

      e.preventDefault();
      win.hide();

      if (preferenceStore.get(COLLAPSE_TO_TRAY_PREFERENCE_KEY) === "true") {
        app.dock.hide();
      }
    });
  }

  win.once("closed", () => {
    win = null;
  });

  if (serve) {
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

  // Emitted when the window is closed.
  // win.on('closed', () => {
  //   // Dereference the window object, usually you would store window
  //   // in an array if your app supports multi windows, this is the time
  //   // when you should delete the corresponding element.
  //   win = null;
  // });

  // win.on('minimize', function (event) {
  //   event.preventDefault();
  //   win.hide();
  // });

  // win.on('restore', function (event) {
  //   win.show();
  // });

  return win;
}

try {
  // Adapted from https://github.com/electron/electron/blob/master/docs/api/app.md#apprequestsingleinstancelock
  const singleInstanceLock = app.requestSingleInstanceLock();
  if (!singleInstanceLock) {
    app.quit();
  } else {
    app.on("second-instance", (event, commandLine, workingDirectory) => {
      // Someone tried to run a second instance, we should focus our window.
      if (win) {
        if (win.isMinimized()) {
          win.restore();
        }
        win.focus();
      }
    });
  }

  app.allowRendererProcessReuse = true;

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  // Added 400 ms to fix the black background issue while using transparent window. More detais at https://github.com/electron/electron/issues/15947
  app.on("ready", () => {
    setTimeout(() => {
      createWindow();
      createTray();
    }, 400);
  });

  app.on("before-quit", (e) => {
    appIsQuitting = true;
  });

  // Quit when all windows are closed.
  app.on("window-all-closed", () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (isMac) {
      app.dock.show();
      win.show();
    }

    if (win === null) {
      createWindow();
    }
  });
} catch (e) {
  // Catch Error
  // throw e;
}

function getAppMenu(): Array<MenuItemConstructorOptions | MenuItem> {
  if (isMac) {
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
  } else if (isWin) {
    return [
      {
        label: "View",
        submenu: [
          { role: "resetZoom" },
          { role: "zoomIn", accelerator: "CommandOrControl+=" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
    ];
  } else if (isLinux) {
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
