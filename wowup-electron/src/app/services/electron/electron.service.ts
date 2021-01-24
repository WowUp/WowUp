import { Injectable } from "@angular/core";
import {
  APP_UPDATE_CHECK_END,
  APP_UPDATE_CHECK_START,
  APP_UPDATE_DOWNLOADED,
  APP_UPDATE_START_DOWNLOAD,
  CLOSE_WINDOW,
  MAXIMIZE_WINDOW,
  MINIMIZE_WINDOW,
  POWER_MONITOR_LOCK,
  POWER_MONITOR_RESUME,
  POWER_MONITOR_SUSPEND,
  POWER_MONITOR_UNLOCK,
  QUIT_APP,
  RESTART_APP,
  WINDOW_LEAVE_FULLSCREEN,
  WINDOW_MAXIMIZED,
  WINDOW_MINIMIZED,
  WINDOW_UNMAXIMIZED,
  ZOOM_FACTOR_KEY,
} from "../../../common/constants";
import * as minimist from "minimist";
// If you import a module but never use any of the imported values other than as TypeScript types,
// the resulting javascript file will look as if you never imported the module at all.
import { IpcRendererEvent, OpenDialogOptions, OpenDialogReturnValue, OpenExternalOptions, Settings } from "electron";
import { BehaviorSubject } from "rxjs";
import { v4 as uuidv4 } from "uuid";
import { IpcRequest } from "../../../common/models/ipc-request";
import { IpcResponse } from "../../../common/models/ipc-response";
import { ValueRequest } from "../../../common/models/value-request";
import { ValueResponse } from "../../../common/models/value-response";
import { AppOptions } from "../../../common/wowup/app-options";
import { ZoomDirection, ZOOM_SCALE } from "../../utils/zoom.utils";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { MainChannels, RendererChannels } from "../../../common/wowup";
import { LoginItemSettings } from "electron/main";

@Injectable({
  providedIn: "root",
})
export class ElectronService {
  private readonly _windowMaximizedSrc = new BehaviorSubject(false);
  private readonly _windowMinimizedSrc = new BehaviorSubject(false);
  private readonly _ipcEventReceivedSrc = new BehaviorSubject("");
  private readonly _zoomFactorChangeSrc = new BehaviorSubject(1.0);
  private readonly _powerMonitorSrc = new BehaviorSubject("");

  private _appVersion = "";

  public readonly windowMaximized$ = this._windowMaximizedSrc.asObservable();
  public readonly windowMinimized$ = this._windowMinimizedSrc.asObservable();
  public readonly ipcEventReceived$ = this._ipcEventReceivedSrc.asObservable();
  public readonly zoomFactor$ = this._zoomFactorChangeSrc.asObservable();
  public readonly powerMonitor$ = this._powerMonitorSrc.asObservable();
  public readonly isWin = process.platform === "win32";
  public readonly isMac = process.platform === "darwin";
  public readonly isLinux = process.platform === "linux";
  public readonly isPortable = !!process.env.PORTABLE_EXECUTABLE_DIR;

  public get isElectron(): boolean {
    return !!(window && window.process && window.process.type);
  }

  constructor(private _preferenceStorageService: PreferenceStorageService) {
    // Conditional imports
    if (!this.isElectron) {
      return;
    }

    console.log("Platform", process.platform, this.isLinux);

    window.addEventListener("online", this.onWindowOnline);
    window.addEventListener("offline", this.onWindowOffline);

    this.invoke("get-app-version")
      .then((version) => {
        this._appVersion = version;
      })
      .catch((e) => {
        console.error("Failed to get app version", e);
      });

    this.onRendererEvent(APP_UPDATE_CHECK_START, () => {
      this._ipcEventReceivedSrc.next(APP_UPDATE_CHECK_START);
    });

    this.onRendererEvent(APP_UPDATE_CHECK_END, () => {
      this._ipcEventReceivedSrc.next(APP_UPDATE_CHECK_END);
    });

    this.onRendererEvent(APP_UPDATE_START_DOWNLOAD, () => {
      this._ipcEventReceivedSrc.next(APP_UPDATE_START_DOWNLOAD);
    });

    this.onRendererEvent(APP_UPDATE_DOWNLOADED, () => {
      this._ipcEventReceivedSrc.next(APP_UPDATE_DOWNLOADED);
    });

    this.onRendererEvent(WINDOW_MINIMIZED, () => {
      this._windowMinimizedSrc.next(true);
    });

    this.onRendererEvent(WINDOW_MAXIMIZED, () => {
      this._windowMaximizedSrc.next(true);
    });

    this.onRendererEvent(WINDOW_UNMAXIMIZED, () => {
      this._windowMaximizedSrc.next(false);
    });

    this.onRendererEvent(POWER_MONITOR_LOCK, () => {
      console.log("POWER_MONITOR_LOCK received");
      this._powerMonitorSrc.next(POWER_MONITOR_LOCK);
    });

    this.onRendererEvent(POWER_MONITOR_UNLOCK, () => {
      console.log("POWER_MONITOR_UNLOCK received");
      this._powerMonitorSrc.next(POWER_MONITOR_UNLOCK);
    });

    this.onRendererEvent(POWER_MONITOR_SUSPEND, () => {
      console.log("POWER_MONITOR_SUSPEND received");
      this._powerMonitorSrc.next(POWER_MONITOR_SUSPEND);
    });

    this.onRendererEvent(POWER_MONITOR_RESUME, () => {
      console.log("POWER_MONITOR_RESUME received");
      this._powerMonitorSrc.next(POWER_MONITOR_RESUME);
    });

    this.invoke("set-zoom-limits", 1, 1).catch((e) => {
      console.error("Failed to set zoom limits", e);
    });

    window.wowup.onRendererEvent("zoom-changed", async (evt, zoomDirection: string) => {
      switch (zoomDirection) {
        case "in":
          this.setZoomFactor(await this.getNextZoomInFactor());
          break;
        case "out":
          this.setZoomFactor(await this.getNextZoomOutFactor());
          break;
        default:
          break;
      }
    });

    this.getZoomFactor()
      .then((zoom) => this._zoomFactorChangeSrc.next(zoom))
      .catch((e) => console.error("Failed to set initial zoom"));
  }

  private onWindowOnline(evt: Event) {
    console.log("Window online...");
  }

  private onWindowOffline(evt: Event) {
    console.warn("Window offline...");
  }

  public getLoginItemSettings(): Promise<LoginItemSettings> {
    return this.invoke("get-login-item-settings");
  }

  public setLoginItemSettings(settings: Settings) {
    return this.invoke("set-login-item-settings", settings);
  }

  public async getAppOptions(): Promise<AppOptions> {
    const launchArgs = await this.invoke("get-launch-args");
    return (<any>minimist(launchArgs.slice(1), {
      boolean: ["hidden", "quit"],
      string: ["install"]
    })) as AppOptions;
  }

  public onRendererEvent(channel: MainChannels, listener: (event: IpcRendererEvent, ...args: any[]) => void) {
    window.wowup.onRendererEvent(channel, listener);
  }

  public async getLocale() {
    const locale = await this.invoke("get-locale");
    return locale.split("-")[0];
  }

  public getVersionNumber(): Promise<string> {
    return this.invoke("get-app-version");
  }

  public minimizeWindow() {
    this.invoke(MINIMIZE_WINDOW);
  }

  public maximizeWindow() {
    this.invoke(MAXIMIZE_WINDOW);
  }

  public unmaximizeWindow() {
    this.invoke(MAXIMIZE_WINDOW);
  }

  public restartApplication() {
    this.invoke(RESTART_APP);
  }

  public quitApplication() {
    this.invoke(QUIT_APP);
  }

  public closeWindow() {
    this.invoke(CLOSE_WINDOW);
  }

  public leaveFullScreen() {
    this.invoke(WINDOW_LEAVE_FULLSCREEN);
  }

  public showNotification(title: string, options?: NotificationOptions) {
    return new Notification(title, options);
  }

  public isHandlingProtocol(protocol: string): boolean {
    return window.wowup.isDefaultProtocolClient(protocol);
  }

  public setHandleProtocol(protocol: string, enable: boolean) {
    if (enable) {
      return window.wowup.setAsDefaultProtocolClient(protocol);
    } else {
      return window.wowup.removeAsDefaultProtocolClient(protocol);
    }
  }

  public showOpenDialog(options: OpenDialogOptions): Promise<OpenDialogReturnValue> {
    return window.wowup.showOpenDialog(options);
  }

  public getUserDefaultSystemPreference(
    key: string,
    type: "string" | "boolean" | "integer" | "float" | "double" | "url" | "array" | "dictionary"
  ) {
    return window.wowup.systemPreferences.getUserDefault(key, type);
  }

  public async sendIpcValueMessage<TIN, TOUT>(channel: string, value: TIN): Promise<TOUT> {
    const request: ValueRequest<TIN> = {
      value,
      responseKey: uuidv4(),
    };

    const response = await this.sendIPCMessage<ValueRequest<TIN>, ValueResponse<TOUT>>(channel, request);

    return response.value;
  }

  public sendIPCMessage<TIN extends IpcRequest, TOUT extends IpcResponse>(
    channel: string,
    request: TIN
  ): Promise<TOUT> {
    return new Promise((resolve, reject) => {
      window.wowup.onceRendererEvent(request.responseKey, (_evt: any, arg: TOUT) => {
        if (arg.error) {
          return reject(arg.error);
        }
        resolve(arg);
      });
      window.wowup.rendererSend(channel, request);
    });
  }

  public async invoke(channel: RendererChannels, ...args: any[]): Promise<any> {
    return await window.wowup.rendererInvoke(channel, ...args);
  }

  public on(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) {
    window.wowup.rendererOn(channel, listener);
  }

  public off(event: string | symbol, listener: (...args: any[]) => void) {
    window.wowup.rendererOff(event, listener);
  }

  public send(channel: string, ...args: any[]) {
    window.wowup.rendererSend(channel, ...args);
  }

  public openExternal(url: string, options?: OpenExternalOptions) {
    return window.wowup.openExternal(url, options);
  }

  public openPath(path: string): Promise<string> {
    return window.wowup.openPath(path);
  }

  public applyZoom = async (zoomDirection: ZoomDirection) => {
    switch (zoomDirection) {
      case ZoomDirection.ZoomIn:
        this.setZoomFactor(await this.getNextZoomInFactor());
        break;
      case ZoomDirection.ZoomOut:
        this.setZoomFactor(await this.getNextZoomOutFactor());
        break;
      case ZoomDirection.ZoomReset:
        this.setZoomFactor(1.0);
        break;
      case ZoomDirection.ZoomUnknown:
      default:
        break;
    }
  };

  public setZoomFactor = async (zoomFactor: number) => {
    await this.invoke("set-zoom-factor", zoomFactor);
    this._zoomFactorChangeSrc.next(zoomFactor);
    this._preferenceStorageService.set(ZOOM_FACTOR_KEY, zoomFactor);
  };

  public getZoomFactor(): Promise<number> {
    return this.invoke("get-zoom-factor");
  }

  private async getNextZoomInFactor(): Promise<number> {
    const windowZoomFactor = await this.getZoomFactor();
    let zoomFactor = Math.round(windowZoomFactor * 100) / 100;
    let zoomIndex = ZOOM_SCALE.indexOf(zoomFactor);
    if (zoomIndex == -1) {
      return 1.0;
    }
    zoomIndex = Math.min(zoomIndex + 1, ZOOM_SCALE.length - 1);
    return ZOOM_SCALE[zoomIndex];
  }

  private async getNextZoomOutFactor(): Promise<number> {
    const windowZoomFactor = await this.getZoomFactor();
    let zoomFactor = Math.round(windowZoomFactor * 100) / 100;
    let zoomIndex = ZOOM_SCALE.indexOf(zoomFactor);
    if (zoomIndex == -1) {
      return 1.0;
    }
    zoomIndex = Math.max(zoomIndex - 1, 0);
    return ZOOM_SCALE[zoomIndex];
  }
}
