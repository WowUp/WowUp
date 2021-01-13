import { BrowserWindow, Rectangle, screen } from "electron";
import * as log from "electron-log";
import * as Store from "electron-store";
import { minBy } from "lodash";
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { MIN_VISIBLE_ON_SCREEN, WINDOW_MIN_HEIGHT, WINDOW_MIN_WIDTH } from "./src/common/constants";
import { WindowState } from "./src/common/models/window-state";

const preferenceStore = new Store({ name: "preferences" });

function getNearestScreen(x: number, y: number) {
  const displays = screen.getAllDisplays();
  return minBy(displays, (display) => Math.hypot(display.bounds.x - x, display.bounds.y - y));
}

function getMaxScreenX(display: Electron.Display) {
  return display.bounds.x + display.bounds.width;
}

function getMaxScreenY(display: Electron.Display) {
  return display.bounds.y + display.bounds.height;
}

function constrainCoordinate(n: number, min: number, max: number) {
  if (n < min) {
    return min;
  } else if (n > max) {
    return max;
  }
  return n;
}

function getConstrainedCoordinates(window: BrowserWindow) {
  const bounds = window.getBounds();
  const nearestScreen = getNearestScreen(bounds.x, bounds.y);

  return {
    x: constrainCoordinate(bounds.x, nearestScreen.bounds.x, getMaxScreenX(nearestScreen)),
    y: constrainCoordinate(bounds.y, nearestScreen.bounds.y, getMaxScreenY(nearestScreen)),
  };
}

export function windowStateManager(windowName: string, { width, height }: { width: number; height: number }) {
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

      // const valid = screen.getAllDisplays().some((display) => {
      //   return (
      //     windowState.x >= display.bounds.x &&
      //     windowState.y >= display.bounds.y &&
      //     windowState.x + windowState.width <= display.bounds.x + display.bounds.width &&
      //     windowState.y + windowState.height <= display.bounds.y + display.bounds.height
      //   );
      // });

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
    // win.on("resize", () => saveState$.next());
    // win.on("move", () => saveState$.next());
    // win.on("closed", () => saveState$.unsubscribe());
  }

  // saveState$.pipe(debounceTime(500)).subscribe(() => saveState());

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
