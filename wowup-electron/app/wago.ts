import { BrowserWindow, ipcMain, WebContents } from "electron";
import * as log from "electron-log";

class WagoHandler {
  private _initialized = false;
  private _window: BrowserWindow | undefined = undefined;
  private _tokenTimer: ReturnType<typeof setTimeout> | undefined = undefined;
  private _webContents: WebContents | undefined = undefined;

  initialize(window: BrowserWindow): void {
    if (this._initialized) {
      return;
    }

    this._window = window;

    // Just forward the token event out to the window
    // this is not a handler, just a passive listener
    ipcMain.on("wago-token-received", (evt, token: string) => {
      if (token.length < 20) {
        log.warn(`[wago-handler] malformed token detected: ${token.length}`);
        return;
      }

      log.warn("[wago-handler] clearing reload timer");
      clearTimeout(this._tokenTimer);
      this._tokenTimer = undefined;
      this._window?.webContents?.send("wago-token-received", token);
    });
  }

  initializeWebContents(webContents: WebContents) {
    if (this._webContents !== undefined) {
      log.warn("[wago-handler] unable to set webcontents, already exists", this._webContents.id, webContents.id);
      return;
    }

    this._webContents = webContents;

    webContents.on("did-fail-provisional-load", (evt, errCode, errDesc) => {
      log.error("[webview] did-fail-provisional-load", errCode, errDesc);
      this.setReloadTime(webContents);
    });

    webContents.on("did-fail-load", (evt, code, desc, url) => {
      log.error("[wago-handler] did-fail-load", code, desc, url);
      this.setReloadTime(webContents);
    });

    webContents.on("will-navigate", (evt, url) => {
      log.debug("[wago-handler] will-navigate", url);
      if (webContents.getURL() === url) {
        log.debug(`[wago-handler] reload detected`);
      } else {
        evt.preventDefault(); // block the webview from navigating at all
      }
    });

    // webview allowpopups must be enabled for any link to work
    // https://www.electronjs.org/docs/latest/api/webview-tag#allowpopups
    webContents.setWindowOpenHandler((details) => {
      log.debug("[webview] setWindowOpenHandler");
      this._window?.webContents.send("webview-new-window", details); // forward this new window to the app for processing
      return { action: "deny" };
    });
  }

  private setReloadTime(webContents: WebContents) {
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
