import { BrowserWindow, ipcMain, powerMonitor, WebContents } from "electron";
import * as log from "electron-log";

class WagoHandler {
  private _initialized = false;
  private _window: BrowserWindow | undefined = undefined;
  private _tokenTimer: ReturnType<typeof setTimeout> | undefined = undefined;
  private _webContents: WebContents | undefined = undefined;
  private _tokenMap = new Map<number, boolean>();

  public constructor() {
    powerMonitor.on("resume", () => {
      log.info("[wago-handler] powerMonitor resume");
      this._tokenMap.clear();
      this._webContents?.reload();
    });
  }

  public initialize(window: BrowserWindow): void {
    if (this._initialized) {
      return;
    }

    this._window = window;

    // Just forward the token event out to the window
    // this is not a handler, just a passive listener
    ipcMain.on("wago-token-received", (evt, token: string) => {
      if (typeof token !== "string" || token.length < 20) {
        log.warn(`[wago-handler] malformed token detected: ${token.length}`);
        return;
      }

      log.warn("[wago-handler] clearing reload timer");
      this._tokenMap.set(this._webContents?.id ?? 0, true);
      this.stopTimeout();
      this._window?.webContents?.send("wago-token-received", token);
    });
  }

  public initializeWebContents(webContents: WebContents) {
    if (this._webContents !== undefined) {
      this.removeListeners(this._webContents);
    }

    this._webContents = webContents;

    webContents.on("did-fail-provisional-load", this.onDidFailProvisionalLoad);
    webContents.on("did-fail-load", this.onDidFail);
    webContents.on("will-navigate", this.onWillNavigate);
    webContents.on("did-finish-load", () => {
      // log.debug("[wago-handler] did-finish-load");
      if (this._tokenMap.has(webContents.id)) {
        this.stopTimeout();
      }
    });

    // webview allowpopups must be enabled for any link to work
    // https://www.electronjs.org/docs/latest/api/webview-tag#allowpopups
    webContents.setWindowOpenHandler(this.onWindowOpenHandler);
  }

  private stopTimeout() {
    clearTimeout(this._tokenTimer);
    this._tokenTimer = undefined;
  }

  private readonly onDidFailProvisionalLoad = (evt: Electron.Event, code: number, description: string) => {
    log.error("[webview] did-fail-provisional-load", code, description);
    if (this._webContents !== undefined) {
      this.setReloadTime(this._webContents);
    }
  };

  private readonly onDidFail = (evt: Electron.Event, code: number, description: string, url: string) => {
    log.error("[wago-handler] did-fail-load", code, description, url);
    if (this._webContents !== undefined) {
      this.setReloadTime(this._webContents);
    }
  };

  private readonly onWillNavigate = (evt: Electron.Event, url: string) => {
    log.debug("[wago-handler] will-navigate", url);
    if (this._webContents !== undefined && this._webContents.getURL() === url) {
      log.debug(`[wago-handler] reload detected`);
    } else {
      evt.preventDefault(); // block the webview from navigating at all
    }
  };

  private readonly onWindowOpenHandler = (details: Electron.HandlerDetails): { action: "deny" } => {
    log.debug("[webview] setWindowOpenHandler");
    this._window?.webContents.send("webview-new-window", details); // forward this new window to the app for processing
    return { action: "deny" };
  };

  private removeListeners(webContents: WebContents) {
    this.stopTimeout();
    webContents.off("did-fail-provisional-load", this.onDidFailProvisionalLoad);
    webContents.off("did-fail-load", this.onDidFail);
    webContents.off("will-navigate", this.onWillNavigate);
    webContents.setWindowOpenHandler(() => ({ action: "allow" }));
  }

  private setReloadTime(webContents: WebContents) {
    if (this._tokenMap.has(webContents.id)) {
      return;
    }

    if (this._tokenTimer === undefined) {
      log.warn("[wago-handler] setting reload timer");
      this._tokenTimer = setTimeout(() => {
        log.error("[wago-handler] reload");
        webContents.reload();
      }, 5000);
    }
  }
}

export const wagoHandler = new WagoHandler();
