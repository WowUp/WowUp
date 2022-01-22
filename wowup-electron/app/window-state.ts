import { app, BrowserWindow, Rectangle, screen } from "electron";
import * as log from "electron-log";

import { IPC_WINDOW_RESUME, MIN_VISIBLE_ON_SCREEN } from "../src/common/constants";
import * as platform from "./platform";
import { preferenceStore } from "./stores";

export interface WindowState extends Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isFullScreen: boolean;
  centered?: boolean;
}

interface WuWindowState extends WindowState {
  monitorState: (win: BrowserWindow) => void;
}

export function restoreWindow(window: BrowserWindow): void {
  window?.show();
  window?.setSkipTaskbar(false);

  if (platform.isMac) {
    app.dock.show().catch((e) => log.error(`Failed to show on Mac dock`, e));
  }

  window?.webContents?.send(IPC_WINDOW_RESUME);
}

export function windowStateManager(
  windowName: string,
  { width, height }: { width: number; height: number }
): WuWindowState {
  let window: BrowserWindow;
  let windowState: WindowState;
  // const saveState$ = new Subject<void>();

  function setState() {
    let setDefaults = false;
    windowState = preferenceStore.get(`${windowName}-window-state`) as WindowState;

    if (!windowState) {
      setDefaults = true;
    } else {
      log.info("found window state:", windowState);

      if (!isVisibleOnScreen(windowState)) {
        log.info("reset window state, bounds are outside displays");
        setDefaults = true;
      }
    }

    if (setDefaults) {
      log.info("setting window defaults");
      windowState = <WindowState>{ width, height, centered: true };
    }

    windowState.centered = false;
  }

  function saveState() {
    const bounds = window.getBounds();

    windowState = { ...windowState, ...bounds };
    windowState.isMaximized = window.isMaximized();
    windowState.isFullScreen = window.isFullScreen();
    preferenceStore.set(`${windowName}-window-state`, windowState);
  }

  function monitorState(win: BrowserWindow) {
    window = win;

    win.on("close", saveState);
  }

  setState();

  return {
    ...windowState,
    monitorState,
  };
}

function doRectanglesOverlap(a: Rectangle, b: Rectangle) {
  const ax1 = a.x + a.width;
  const bx1 = b.x + b.width;
  const ay1 = a.y + a.height;
  const by1 = b.y + b.height; // clamp a to b, see if it is non-empty

  const cx0 = a.x < b.x ? b.x : a.x;
  const cx1 = ax1 < bx1 ? ax1 : bx1;

  if (cx1 - cx0 > 0) {
    const cy0 = a.y < b.y ? b.y : a.y;
    const cy1 = ay1 < by1 ? ay1 : by1;

    if (cy1 - cy0 > 0) {
      return true;
    }
  }

  return false;
}

// Lifted from Discord to check where to display the window
function isVisibleOnScreen(windowState: WindowState) {
  let isVisibleOnAnyScreen = false;

  log.info(windowState);

  const displays = screen.getAllDisplays();
  for (const display of displays) {
    const displayBound = display.workArea;
    displayBound.x += MIN_VISIBLE_ON_SCREEN;
    displayBound.y += MIN_VISIBLE_ON_SCREEN;
    displayBound.width -= 2 * MIN_VISIBLE_ON_SCREEN;
    displayBound.height -= 2 * MIN_VISIBLE_ON_SCREEN;
    isVisibleOnAnyScreen = doRectanglesOverlap(windowState, displayBound);

    log.info("isVisibleOnAnyScreen", displayBound, isVisibleOnAnyScreen);
    if (isVisibleOnAnyScreen) {
      break;
    }
  }

  return isVisibleOnAnyScreen;
}
