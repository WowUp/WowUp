import { app, BrowserWindow, BrowserWindowConstructorOptions, Display, Rectangle, screen } from "electron";
import * as log from "electron-log";

import { IPC_WINDOW_RESUME, MIN_VISIBLE_ON_SCREEN, WINDOW_MIN_HEIGHT, WINDOW_MIN_WIDTH } from "../src/common/constants";
import * as platform from "./platform";
import { preferenceStore } from "./stores";

export function wasMaximized() {
  return preferenceStore.get(`main-window-is-maximized`) as boolean;
}

export function wasFullScreen() {
  return preferenceStore.get(`main-window-is-fullscreen`) as boolean;
}

export function saveWindowConfig(window: BrowserWindow): void {
  try {
    if (!window) {
      return;
    }

    preferenceStore.set(`main-window-is-maximized`, window.isMaximized());
    preferenceStore.set(`main-window-is-minimized`, window.isMinimized());
    preferenceStore.set(`main-window-is-fullscreen`, window.isFullScreen());

    if (!window.isMinimized() && !window.isMaximized()) {
      preferenceStore.set(`main-window-state`, window.getBounds());
    } else if (window.isMaximized()) {
      // Attempt to reduce the placement so its remember but in bounds
      const bounds = window.getBounds();
      bounds.x += 50;
      bounds.y += 50;
      bounds.width -= 100;
      bounds.height -= 100;
      preferenceStore.set(`main-window-state`, bounds);
    }

    log.info("window config saved");
  } catch (e) {
    log.error(e);
  }
}

export function applyWindowBoundsToConfig(config: BrowserWindowConstructorOptions) {
  const state = getWindowConfig();

  if (state == null) {
    config.center = true;
    return;
  }

  config.width = state.width;
  config.height = state.height;
  config.x = state.x;
  config.y = state.y;
}

export function restoreMainWindowBounds(mainWindow: BrowserWindow) {
  const savedWindowBounds = getWindowConfig();
  const currentBounds = mainWindow.getBounds();

  if (
    savedWindowBounds != null &&
    (currentBounds.height !== savedWindowBounds.height || currentBounds.width !== savedWindowBounds.width)
  ) {
    mainWindow.setBounds(savedWindowBounds);
  }
}

export function getWindowConfig() {
  let state: Rectangle = preferenceStore.get(`main-window-state`) as Rectangle;
  if (!state) {
    state = {
      height: 0,
      width: 0,
      x: 0,
      y: 0,
    };
  }

  state.width = Math.max(WINDOW_MIN_WIDTH, state.width);
  state.height = Math.max(WINDOW_MIN_HEIGHT, state.height);

  const displays = screen.getAllDisplays();
  const display = getDisplayForBounds(displays, state);
  return display != null ? state : null;
}

export function restoreWindow(window: BrowserWindow): void {
  window?.show();
  window?.setSkipTaskbar(false);

  if (platform.isMac) {
    app.dock.show().catch((e) => log.error(`Failed to show on Mac dock`, e));
  }

  window?.webContents?.send(IPC_WINDOW_RESUME);
}

function getDisplayForBounds(displays: Display[], bounds: Rectangle) {
  return displays.find((display) => {
    const displayBound = display.workArea;
    displayBound.x += MIN_VISIBLE_ON_SCREEN;
    displayBound.y += MIN_VISIBLE_ON_SCREEN;
    displayBound.width -= 2 * MIN_VISIBLE_ON_SCREEN;
    displayBound.height -= 2 * MIN_VISIBLE_ON_SCREEN;
    return doRectanglesOverlap(bounds, displayBound);
  });
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
