import { app, BrowserWindow, BrowserWindowConstructorOptions, Display, Rectangle, screen } from "electron";
import * as log from "electron-log/main";

import { IPC_WINDOW_RESUME, MIN_VISIBLE_ON_SCREEN, WINDOW_MIN_HEIGHT, WINDOW_MIN_WIDTH } from "../src/common/constants";
import * as platform from "./platform";
import { getPreferenceStore } from "./stores";

// Diagnostics for window placement across monitors (https://github.com/WowUp/WowUp/issues/1586).
// Every line is tagged so a reporter's main.log can be filtered with one search.
const wsLog = log.scope("window-state");

// How long to keep logging after the window is first shown, long enough to cover the Wago consent
// window opening after startup
const PLACEMENT_TRACKING_MS = 15000;
const PLACEMENT_TRACKING_MAX_WAIT_MS = 120000;
const PLACEMENT_TRACKING_MAX_LINES = 60;

export function wasMaximized() {
  return getPreferenceStore().get(`main-window-is-maximized`) as boolean;
}

export function wasFullScreen() {
  return getPreferenceStore().get(`main-window-is-fullscreen`) as boolean;
}

export function saveWindowConfig(window: BrowserWindow | null): void {
  if (window === null) {
    return;
  }

  try {
    const prefStore = getPreferenceStore();
    prefStore.set(`main-window-is-maximized`, window.isMaximized());
    prefStore.set(`main-window-is-minimized`, window.isMinimized());
    prefStore.set(`main-window-is-fullscreen`, window.isFullScreen());

    if (!window.isMinimized() && !window.isMaximized()) {
      prefStore.set(`main-window-state`, window.getBounds());
    } else if (window.isMaximized()) {
      // Attempt to reduce the placement so its remember but in bounds
      const bounds = window.getBounds();
      bounds.x += 50;
      bounds.y += 50;
      bounds.width -= 100;
      bounds.height -= 100;
      prefStore.set(`main-window-state`, bounds);
    }

    wsLog.info(
      `saved: ${describeBounds(window.getBounds())} maximized=${window.isMaximized()} minimized=${window.isMinimized()} fullscreen=${window.isFullScreen()}`,
    );
  } catch (e) {
    log.error(e);
  }
}

export function applyWindowBoundsToConfig(config: BrowserWindowConstructorOptions) {
  logDisplays("startup");
  wsLog.info(
    `stored: ${JSON.stringify(getPreferenceStore().get(`main-window-state`) ?? null)} maximized=${wasMaximized()} fullscreen=${wasFullScreen()}`,
  );

  const state = getWindowConfig();

  if (state == null) {
    wsLog.info("stored bounds are not on any display, centering on the primary display");
    config.center = true;
    return;
  }

  wsLog.info(`restoring to ${describeBounds(state)}`);

  config.width = state.width;
  config.height = state.height;
  config.x = state.x;
  config.y = state.y;
}

export function restoreMainWindowBounds(mainWindow: BrowserWindow) {
  const savedWindowBounds = getWindowConfig();
  const currentBounds = mainWindow.getBounds();
  wsLog.info(`created at ${describeBounds(currentBounds)}`);

  if (
    savedWindowBounds != null &&
    (currentBounds.height !== savedWindowBounds.height || currentBounds.width !== savedWindowBounds.width)
  ) {
    mainWindow.setBounds(savedWindowBounds);
    wsLog.info(`size differed from stored, setBounds -> ${describeBounds(mainWindow.getBounds())}`);
  }
}

/**
 * Log every change to the main window's placement, and any display changes, for a short time after
 * startup. A window that Windows or Chromium moves to another display after it was shown shows up
 * here as a move/resize event with the new display.
 */
export function trackWindowPlacement(window: BrowserWindow): void {
  const startedAt = Date.now();
  let lines = 0;
  let last = "";

  const record = (event: string) => {
    if (window.isDestroyed() || lines >= PLACEMENT_TRACKING_MAX_LINES) {
      return;
    }

    const line = `${describeBounds(window.getBounds())} visible=${window.isVisible()} maximized=${window.isMaximized()}`;
    // Drags fire a burst of identical move events, only log real changes
    if (line === last && (event === "move" || event === "resize")) {
      return;
    }

    last = line;
    lines += 1;
    wsLog.info(`+${Date.now() - startedAt}ms ${event}: ${line}`);
  };

  const windowEvents = ["show", "focus", "move", "moved", "resize", "maximize", "unmaximize", "enter-full-screen"];
  const listeners = windowEvents.map((event) => {
    const listener = () => record(event);
    window.on(event as Parameters<BrowserWindow["on"]>[0], listener);
    return { event, listener };
  });

  const onDisplaysChanged = (event: string) => () => logDisplays(event);
  const displayListeners = {
    "display-added": onDisplaysChanged("display-added"),
    "display-removed": onDisplaysChanged("display-removed"),
    "display-metrics-changed": onDisplaysChanged("display-metrics-changed"),
  };
  for (const [event, listener] of Object.entries(displayListeners)) {
    screen.on(event as Parameters<typeof screen.on>[0], listener);
  }

  let stopTimer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    clearTimeout(stopTimer);
    record("tracking-end");
    for (const { event, listener } of listeners) {
      if (!window.isDestroyed()) {
        window.removeListener(event as Parameters<BrowserWindow["on"]>[0], listener);
      }
    }
    for (const [event, listener] of Object.entries(displayListeners)) {
      screen.removeListener(event as Parameters<typeof screen.on>[0], listener);
    }
  };

  // The jump happens after the window is first shown, so time the window from then. Starting
  // hidden in the tray may never show it, so give up after a while either way.
  stopTimer = setTimeout(stop, PLACEMENT_TRACKING_MAX_WAIT_MS);
  window.once("show", () => {
    clearTimeout(stopTimer);
    stopTimer = setTimeout(stop, PLACEMENT_TRACKING_MS);
  });
}

/** Describe a rectangle along with the display it lands on, e.g. `-1700,650 1200x800 @1234 (100%)`. */
export function describeBounds(bounds: Rectangle): string {
  const display = screen.getDisplayMatching(bounds);
  const primary = display.id === screen.getPrimaryDisplay().id ? ", primary" : "";
  return `${bounds.x},${bounds.y} ${bounds.width}x${bounds.height} @${display.id} (${Math.round(display.scaleFactor * 100)}%${primary})`;
}

function logDisplays(reason: string) {
  const primaryId = screen.getPrimaryDisplay().id;
  const displays = screen.getAllDisplays().map((d) => {
    const { x, y, width, height } = d.bounds;
    const wa = d.workArea;
    const primary = d.id === primaryId ? " primary" : "";
    return `@${d.id}${primary} ${x},${y} ${width}x${height} work=${wa.x},${wa.y} ${wa.width}x${wa.height} scale=${d.scaleFactor} rotation=${d.rotation}`;
  });
  wsLog.info(
    `displays (${reason}, electron ${process.versions.electron}, ${app.getVersion()}): ${displays.join(" | ")}`,
  );
}

export function getWindowConfig() {
  let state: Rectangle = getPreferenceStore().get(`main-window-state`) as Rectangle;
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
