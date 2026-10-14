import { app, BrowserWindow, Rectangle, WebContentsView } from "electron";
import * as log from "electron-log";
import { join } from "path";
import { AdPageOptions } from "wowup-lib-core";

import { wagoHandler } from "../../wago-handler";

/** Shared with the cmp window so a consent decision applies to both. */
export const AD_PARTITION = "persist:adpartition";

/** The ad page is only ever allowed to be served from these hosts. */
const ALLOWED_AD_HOSTS = ["addons.wago.io"];

const HIDDEN_BOUNDS: Rectangle = { x: 0, y: 0, width: 0, height: 0 };

/**
 * Owns the native view that renders the ad page.
 *
 * The view is a child of the main window rather than a <webview> in the renderer so the ad page
 * gets its own process, its own persistent session partition and a user agent that does not
 * advertise Electron. The renderer reserves a hole in its layout and reports that rect over ipc;
 * everything else about the view is decided here.
 */
export class WagoAdViewService {
  private _view: WebContentsView | undefined;
  private _attached = false;

  /** Rect reported by the renderer, in css pixels. */
  private _hostRect: Rectangle | undefined;

  private _loadedUrl: string | undefined;

  /** Set while something is painted over the ad, e.g. a dialog or the cmp window. */
  private _suppressed = false;

  private _cmpOpen = false;
  private _deferredLoad: AdPageOptions | undefined;

  public constructor(private readonly _window: BrowserWindow) {}

  public load(options: AdPageOptions): void {
    const pageUrl = this.parseAdUrl(options.pageUrl);
    if (pageUrl === undefined) {
      return;
    }

    // The ad network requires that no ad is requested until the consent window is gone, so hold the
    // load until then. The renderer sequences this too, this is the backstop.
    if (this._cmpOpen) {
      log.info("[ad-view] consent window is open, deferring the ad load");
      this._deferredLoad = options;
      return;
    }

    const url = pageUrl.toString();
    const view = this.ensureView(options);

    this.attach();

    // Enabling or disabling any provider re-announces that an ad is required. Reloading here would
    // burn an impression and roll the api key for no reason.
    if (this._loadedUrl === url) {
      return;
    }

    log.info(`[ad-view] loading ${url}`);
    this._loadedUrl = url;

    view.webContents
      .loadURL(url, {
        httpReferrer: options.referrer,
      })
      .catch((e) => {
        // A torn-down or superseded view's rejection can arrive after a newer load already took
        // over, so only clear the state if this load is still the current one.
        if (this._view === view && this._loadedUrl === url) {
          this._loadedUrl = undefined;
        }
        log.error("[ad-view] failed to load ad page", e);
      });
  }

  /**
   * Tear the ad down completely. Used when no enabled provider requires an ad, so the page must
   * stop costing the user network and cpu. The api key that the page hands us is only needed while
   * an ad is required, so losing it here is intentional.
   */
  public disable(): void {
    log.info("[ad-view] disable");
    this.detach();

    const view = this._view;
    this._view = undefined;
    this._hostRect = undefined;
    this._loadedUrl = undefined;
    this._deferredLoad = undefined;

    if (view === undefined) {
      return;
    }

    try {
      if (view.webContents.isDevToolsOpened()) {
        view.webContents.closeDevTools();
      }

      view.webContents.close();
    } catch (e) {
      log.error("[ad-view] failed to close ad view", e);
    }
  }

  /**
   * Position the view over the hole the renderer reserved for it. Passing a zero sized rect (or no
   * rect at all) parks the view without unloading the page, which keeps the ad session and the api
   * key refresh alive.
   */
  public setHostRect(rect: Rectangle | undefined): void {
    this._hostRect = rect !== undefined && rect.width > 0 && rect.height > 0 ? rect : undefined;
    this.applyBounds();
  }

  /**
   * Called when the consent window opens and closes. While it is open the ad view is parked and any
   * load is held back; closing it releases whatever was waiting.
   */
  public setCmpOpen(open: boolean): void {
    this._cmpOpen = open;
    this.setSuppressed(open);

    if (open || this._deferredLoad === undefined) {
      return;
    }

    const options = this._deferredLoad;
    this._deferredLoad = undefined;
    this.load(options);
  }

  /** Park the view while a dialog or the cmp window is covering it, without unloading the page. */
  public setSuppressed(suppressed: boolean): void {
    if (this._suppressed === suppressed) {
      return;
    }

    this._suppressed = suppressed;
    this.applyBounds();
  }

  /** Re-apply the last known rect, e.g. after a window resize or a zoom change. */
  public refreshBounds(): void {
    this.applyBounds();
  }

  public reload(): void {
    this._view?.webContents.reloadIgnoringCache();
  }

  public openDevTools(): void {
    if (this._view === undefined || this._view.webContents.isDevToolsOpened()) {
      return;
    }

    this._view.webContents.openDevTools({ mode: "detach" });
  }

  public dispose(): void {
    this.disable();
  }

  private ensureView(options: AdPageOptions): WebContentsView {
    if (this._view !== undefined) {
      return this._view;
    }

    const view = new WebContentsView({
      webPreferences: {
        // Deliberately not taken from the caller: the consent window has to share this partition or
        // a consent decision would not apply to the ad view.
        partition: AD_PARTITION,
        preload: options.preloadFilePath ? join(app.getAppPath(), "assets", options.preloadFilePath) : undefined,
        contextIsolation: true,
        nodeIntegration: false,
        plugins: false,
        webgl: false,
        sandbox: true,
      },
    });

    view.setBackgroundColor("#00000000");
    view.setBounds(HIDDEN_BOUNDS);

    // The ad network treats an electron user agent as a bot, and we do not want to leak the app
    // version to it either. Anything the provider explicitly asks for wins.
    view.webContents.setUserAgent(options.userAgent ?? this.getScrubbedUserAgent(view));

    // Links in an ad open in the user's browser, gated by the renderer's confirmation dialog.
    view.webContents.setWindowOpenHandler((details) => {
      this._window.webContents.send("webview-new-window", details);
      return { action: "deny" };
    });

    view.webContents.on("preload-error", (_evt, _path, e) => {
      log.error("[ad-view] preload-error", e.message);
    });

    view.webContents.session.setPermissionRequestHandler((_contents, permission, callback) => {
      log.warn("[ad-view] denied permission request", permission);
      return callback(false);
    });

    view.webContents.session.setPermissionCheckHandler((_contents, permission) => {
      return ["background-sync"].includes(permission);
    });

    // Reload/backoff handling and navigation blocking.
    wagoHandler.initializeWebContents(view.webContents);

    this._view = view;
    return view;
  }

  private getScrubbedUserAgent(view: WebContentsView): string {
    const appName = app.getName().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(${appName}|Electron)/[\\d.]+ `, "g");
    return view.webContents.getUserAgent().replace(pattern, "");
  }

  private attach(): void {
    if (this._attached || this._view === undefined || this._window.isDestroyed()) {
      return;
    }

    this._window.contentView.addChildView(this._view);
    this._attached = true;
    this.applyBounds();
  }

  private detach(): void {
    if (!this._attached || this._view === undefined) {
      return;
    }

    this._view.setBounds(HIDDEN_BOUNDS);

    if (!this._window.isDestroyed()) {
      this._window.contentView.removeChildView(this._view);
    }

    this._attached = false;
  }

  private applyBounds(): void {
    if (this._view === undefined || !this._attached || this._window.isDestroyed()) {
      return;
    }

    if (this._hostRect === undefined || this._suppressed) {
      this._view.setBounds(HIDDEN_BOUNDS);
      return;
    }

    this._view.setBounds(this.toViewBounds(this._hostRect));
  }

  /**
   * The renderer measures in css pixels, which the zoom factor scales, while view bounds are in
   * window coordinates. Convert, then clamp so a stale rect cannot push the ad outside the window.
   */
  private toViewBounds(hostRect: Rectangle): Rectangle {
    const zoomFactor = this._window.webContents.getZoomFactor() || 1;
    const { width: windowWidth, height: windowHeight } = this._window.getContentBounds();

    const x = Math.round(hostRect.x * zoomFactor);
    const y = Math.round(hostRect.y * zoomFactor);
    const width = Math.round(hostRect.width * zoomFactor);
    const height = Math.round(hostRect.height * zoomFactor);

    if (x >= windowWidth || y >= windowHeight) {
      return HIDDEN_BOUNDS;
    }

    const clampedX = Math.max(x, 0);
    const clampedY = Math.max(y, 0);

    return {
      x: clampedX,
      y: clampedY,
      width: Math.min(width, windowWidth - clampedX),
      height: Math.min(height, windowHeight - clampedY),
    };
  }

  private parseAdUrl(pageUrl: string): URL | undefined {
    try {
      const url = new URL(pageUrl);
      if (url.protocol !== "https:" || !ALLOWED_AD_HOSTS.includes(url.hostname)) {
        log.error(`[ad-view] refusing to load ad page from ${url.origin}`);
        return undefined;
      }

      return url;
    } catch (e) {
      log.error(`[ad-view] malformed ad page url`, e);
      return undefined;
    }
  }
}
