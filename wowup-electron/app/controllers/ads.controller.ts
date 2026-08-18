import { BrowserWindow, ipcMain, IpcMainInvokeEvent, Rectangle } from "electron";
import { AdPageOptions } from "wowup-lib-core";

import {
  IPC_ADS_DISABLE,
  IPC_ADS_LOAD,
  IPC_ADS_OPEN_DEV_TOOLS,
  IPC_ADS_RELOAD,
  IPC_ADS_RESURFACE_CMP,
  IPC_ADS_SET_BOUNDS,
  IPC_ADS_SHOW_CMP,
} from "../../src/common/constants";
import { AdViewService } from "../services/ads/ad-view.service";
import { CmpWindowService } from "../services/ads/cmp-window.service";
import { IpcController } from "./ipc-controller";

export class AdsController implements IpcController {
  private readonly _adView: AdViewService;
  private readonly _cmpWindow: CmpWindowService;

  public constructor(private readonly _window: BrowserWindow) {
    this._adView = new AdViewService(this._window);
    this._cmpWindow = new CmpWindowService(this._window, (visible) => this._adView.setCmpOpen(visible));
  }

  public register(): void {
    this._cmpWindow.initialize();

    // The main window can be recreated (macos activate with no window), which registers controllers
    // a second time, so replace any handler from a previous window instead of throwing.
    this.handle(IPC_ADS_LOAD, (_evt, options: AdPageOptions) => this._adView.load(options));
    this.handle(IPC_ADS_DISABLE, () => this._adView.disable());
    this.handle(IPC_ADS_SET_BOUNDS, (_evt, rect?: Rectangle) => this._adView.setHostRect(rect));
    this.handle(IPC_ADS_RELOAD, () => this._adView.reload());
    this.handle(IPC_ADS_OPEN_DEV_TOOLS, () => this._adView.openDevTools());
    this.handle(IPC_ADS_SHOW_CMP, () => this._cmpWindow.show());
    this.handle(IPC_ADS_RESURFACE_CMP, () => this._cmpWindow.resurface());

    // The renderer re-reports its rect when the layout or the zoom factor changes, but a window
    // resize can move the ad without resizing anything the renderer observes, so keep the view
    // clamped to the window here as well.
    this._window.on("resize", this.onWindowBoundsChanged);
    this._window.on("enter-full-screen", this.onWindowBoundsChanged);
    this._window.on("leave-full-screen", this.onWindowBoundsChanged);
    this._window.once("closed", this.onWindowClosed);
  }

  private handle(channel: string, listener: (evt: IpcMainInvokeEvent, ...args: any[]) => unknown): void {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, listener);
  }

  private readonly onWindowBoundsChanged = () => {
    this._adView.refreshBounds();
  };

  private readonly onWindowClosed = () => {
    this._window.off("resize", this.onWindowBoundsChanged);
    this._window.off("enter-full-screen", this.onWindowBoundsChanged);
    this._window.off("leave-full-screen", this.onWindowBoundsChanged);

    this._cmpWindow.dispose();
    this._adView.dispose();
  };
}
