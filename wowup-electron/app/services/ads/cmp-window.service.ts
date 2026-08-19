import { app, BrowserWindow, ipcMain } from "electron";
import * as log from "electron-log";
import { join } from "path";

import { IPC_ADS_CMP_CLOSE } from "../../../src/common/constants";
import { AD_PARTITION } from "./wago-ad-view.service";

const CMP_URL = "https://addons.wago.io/app-cmp.html";
const CMP_WINDOW_WIDTH = 1120;
const CMP_WINDOW_HEIGHT = 600;

/**
 * How long to keep the window hidden before showing it. The consent page closes itself when no
 * consent ui is needed, which is the usual outcome on every launch after the user has decided, so
 * holding it back keeps that path invisible instead of flashing an empty modal. A hidden window is
 * not modal yet either, so the app stays clickable while the page makes up its mind.
 */
const CMP_SHOW_DELAY_MS = 2500;

/**
 * Runs the ad network's consent tool.
 *
 * The ad script runs in "app" cmp mode, which means it never renders consent ui inline. Instead the
 * host app is responsible for opening the consent page itself, in a window that shares the ad
 * session partition so the resulting consent applies to the ad view.
 *
 * The page has to run on every launch, not just the first: it is what establishes the consent state
 * the ad page reads, and it decides for itself whether a ui is needed, closing itself when it is not.
 */
export class CmpWindowService {
  private _window: BrowserWindow | undefined;

  /** Resolves when the consent window closes. Ads must not load before that happens. */
  private _closed: Promise<void> | undefined;
  private _resolveClosed: (() => void) | undefined;

  /**
   * @param onVisibleChange Called when the consent window opens or closes, so the caller can park
   * the ad view while it is up. Native child views paint above modal windows.
   */
  public constructor(
    private readonly _parent: BrowserWindow,
    private readonly _onVisibleChange: (visible: boolean) => void,
  ) {}

  public initialize(): void {
    // The consent page asks to be closed over ipc, since a frameless window has no close button
    // and is not always permitted to close itself.
    ipcMain.removeAllListeners(IPC_ADS_CMP_CLOSE);
    ipcMain.on(IPC_ADS_CMP_CLOSE, (evt) => {
      if (this._window === undefined || evt.sender !== this._window.webContents) {
        return;
      }

      log.info("[cmp-window] close requested by consent page");
      this.close();
    });
  }

  /** First run consent prompt. Resolves once the user is done with it. */
  public show(): Promise<void> {
    return this.open(CMP_URL);
  }

  /** Re-open the consent tool so the user can change a decision they already made. */
  public resurface(): Promise<void> {
    return this.open(`${CMP_URL}?resurface=1`);
  }

  public close(): void {
    const window = this._window;
    this._window = undefined;

    if (window !== undefined && !window.isDestroyed()) {
      window.destroy();
    }
  }

  public dispose(): void {
    ipcMain.removeAllListeners(IPC_ADS_CMP_CLOSE);
    this.close();
    // Nobody is left to close the window, so release anyone waiting on it.
    this.settleClosed();
  }

  private open(url: string): Promise<void> {
    if (this._window !== undefined && !this._window.isDestroyed()) {
      log.info("[cmp-window] already open, focusing");
      this._window.focus();
      return this._closed ?? Promise.resolve();
    }

    if (this._parent.isDestroyed()) {
      return Promise.resolve();
    }

    log.info(`[cmp-window] opening ${url}`);

    const window = new BrowserWindow({
      width: CMP_WINDOW_WIDTH,
      height: CMP_WINDOW_HEIGHT,
      parent: this._parent,
      modal: true,
      center: true,
      show: false,
      frame: false,
      titleBarStyle: "hidden",
      transparent: true,
      hasShadow: false,
      resizable: false,
      fullscreen: false,
      skipTaskbar: true,
      webPreferences: {
        partition: AD_PARTITION,
        preload: join(app.getAppPath(), "assets", "preload", "cmp.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    this._window = window;
    this._closed = new Promise<void>((resolve) => {
      this._resolveClosed = resolve;
    });

    const showTimer = setTimeout(() => {
      if (!window.isDestroyed()) {
        log.info("[cmp-window] consent page is still up, showing it");
        window.show();
      }
    }, CMP_SHOW_DELAY_MS);

    window.on("closed", () => {
      clearTimeout(showTimer);

      if (this._window === window) {
        this._window = undefined;
      }

      this._onVisibleChange(false);
      this.settleClosed();
    });

    // Nothing inside the consent tool should navigate the app or spawn windows.
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

    this._onVisibleChange(true);

    window.loadURL(url).catch((e) => {
      log.error("[cmp-window] failed to load consent page", e);
      this.close();
    });

    return this._closed;
  }

  private settleClosed(): void {
    this._resolveClosed?.();
    this._resolveClosed = undefined;
    this._closed = undefined;
  }
}
