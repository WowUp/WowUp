import type { BrowserWindow } from "electron";
import type * as Store from "electron-store";

import {
  IPC_CLOSE_WINDOW,
  IPC_FOCUS_WINDOW,
  IPC_GET_ZOOM_FACTOR,
  IPC_MAXIMIZE_WINDOW,
  IPC_MINIMIZE_WINDOW,
  IPC_SET_ZOOM_FACTOR,
  IPC_SET_ZOOM_LIMITS,
  IPC_WINDOW_IS_FULLSCREEN,
  IPC_WINDOW_IS_MAXIMIZED,
  IPC_WINDOW_LEAVE_FULLSCREEN,
  ZOOM_FACTOR_KEY,
} from "../../src/common/constants";
import { restoreWindow } from "../window-state";
import { ipcHandle, IpcController } from "./ipc-controller";

/** The main window's chrome: the custom titlebar buttons, focus and zoom */
export class WindowController implements IpcController {
  public constructor(
    private readonly _window: BrowserWindow,
    private readonly _preferenceStore: Store,
  ) {}

  public register(): void {
    const window = this._window;

    ipcHandle(IPC_MINIMIZE_WINDOW, () => {
      if (window.minimizable) {
        window.minimize();
      }
    });
    ipcHandle(IPC_MAXIMIZE_WINDOW, () => {
      if (!window.maximizable) {
        return;
      }
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    });
    ipcHandle(IPC_WINDOW_IS_MAXIMIZED, () => window.isMaximized());
    ipcHandle(IPC_WINDOW_LEAVE_FULLSCREEN, () => window.setFullScreen(false));
    ipcHandle(IPC_WINDOW_IS_FULLSCREEN, () => window.isFullScreen());
    ipcHandle(IPC_CLOSE_WINDOW, () => window.close());
    ipcHandle(IPC_FOCUS_WINDOW, () => {
      restoreWindow(window);
      window.focus();
    });
    ipcHandle("get-focus", () => window.isFocused());

    ipcHandle(IPC_GET_ZOOM_FACTOR, () => window.webContents.getZoomFactor());
    ipcHandle(IPC_SET_ZOOM_FACTOR, (_evt, zoomFactor: number) => {
      window.webContents.zoomFactor = zoomFactor;
      this._preferenceStore.set(ZOOM_FACTOR_KEY, zoomFactor);
    });
    ipcHandle(IPC_SET_ZOOM_LIMITS, (_evt, minimumLevel: number, maximumLevel: number) =>
      window.webContents.setVisualZoomLevelLimits(minimumLevel, maximumLevel),
    );
  }
}
