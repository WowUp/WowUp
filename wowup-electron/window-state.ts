import { BrowserWindow, screen } from "electron";
import * as log from "electron-log";
import * as Store from "electron-store";
import { minBy } from "lodash";
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
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
  const saveState$ = new Subject<void>();

  function setState() {
    let setDefaults = false;
    windowState = preferenceStore.get(`${windowName}-window-state`) as WindowState;

    if (!windowState) {
      setDefaults = true;
    } else {
      log.info("found window state:", windowState);

      const valid = screen.getAllDisplays().some((display) => {
        return (
          windowState.x >= display.bounds.x &&
          windowState.y >= display.bounds.y &&
          windowState.x + windowState.width <= display.bounds.x + display.bounds.width &&
          windowState.y + windowState.height <= display.bounds.y + display.bounds.height
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
    const bounds = window.getBounds();
    const constrained = getConstrainedCoordinates(window);
    windowState.x = constrained.x;
    windowState.y = constrained.y;

    if (!window.isMaximized() && !window.isFullScreen()) {
      windowState = { ...windowState, width: bounds.width, height: bounds.height };
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
