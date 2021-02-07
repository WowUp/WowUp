import { Injectable } from "@angular/core";
import {
  APP_UPDATE_CHECK_END,
  APP_UPDATE_CHECK_START,
  APP_UPDATE_DOWNLOADED,
  APP_UPDATE_START_DOWNLOAD,
  IPC_CLOSE_WINDOW,
  IPC_GET_APP_VERSION,
  IPC_GET_LAUNCH_ARGS,
  IPC_GET_LOCALE,
  IPC_GET_LOGIN_ITEM_SETTINGS,
  IPC_GET_ZOOM_FACTOR,
  IPC_SET_LOGIN_ITEM_SETTINGS,
  IPC_SET_ZOOM_FACTOR,
  IPC_SET_ZOOM_LIMITS,
  IPC_MAXIMIZE_WINDOW,
  IPC_MINIMIZE_WINDOW,
  IPC_POWER_MONITOR_LOCK,
  IPC_POWER_MONITOR_RESUME,
  IPC_POWER_MONITOR_SUSPEND,
  IPC_POWER_MONITOR_UNLOCK,
  IPC_QUIT_APP,
  IPC_RESTART_APP,
  IPC_WINDOW_LEAVE_FULLSCREEN,
  IPC_WINDOW_MAXIMIZED,
  IPC_WINDOW_MINIMIZED,
  IPC_WINDOW_UNMAXIMIZED,
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

    this.invoke(IPC_GET_APP_VERSION)
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

    this.onRendererEvent(IPC_WINDOW_MINIMIZED, () => {
      this._windowMinimizedSrc.next(true);
    });

    this.onRendererEvent(IPC_WINDOW_MAXIMIZED, () => {
      this._windowMaximizedSrc.next(true);
    });

    this.onRendererEvent(IPC_WINDOW_UNMAXIMIZED, () => {
      this._windowMaximizedSrc.next(false);
    });

    this.onRendererEvent(IPC_POWER_MONITOR_LOCK, () => {
      console.log("POWER_MONITOR_LOCK received");
      this._powerMonitorSrc.next(IPC_POWER_MONITOR_LOCK);
    });

    this.onRendererEvent(IPC_POWER_MONITOR_UNLOCK, () => {
      console.log("POWER_MONITOR_UNLOCK received");
      this._powerMonitorSrc.next(IPC_POWER_MONITOR_UNLOCK);
    });

    this.onRendererEvent(IPC_POWER_MONITOR_SUSPEND, () => {
      console.log("POWER_MONITOR_SUSPEND received");
      this._powerMonitorSrc.next(IPC_POWER_MONITOR_SUSPEND);
    });

    this.onRendererEvent(IPC_POWER_MONITOR_RESUME, () => {
      console.log("POWER_MONITOR_RESUME received");
      this._powerMonitorSrc.next(IPC_POWER_MONITOR_RESUME);
    });

    this.invoke(IPC_SET_ZOOM_LIMITS, 1, 1).catch((e) => {
      console.error("Failed to set zoom limits", e);
    });

    window.wowup.onRendererEvent("zoom-changed", (_evt, zoomDirection: string) => {
      this.onWindowZoomChanged(zoomDirection).catch((e) => console.error(e));
    });

    this.getZoomFactor()
      .then((zoom) => this._zoomFactorChangeSrc.next(zoom))
      .catch(() => console.error("Failed to set initial zoom"));
  }

  private async onWindowZoomChanged(zoomDirection: string) {
    if (zoomDirection === "in") {
      const factor = await this.getNextZoomInFactor();
      await this.setZoomFactor(factor);
    } else if (zoomDirection === "out") {
      const factor = await this.getNextZoomOutFactor();
      await this.setZoomFactor(factor);
    }
  }

  private onWindowOnline = () => {
    console.log("Window online...");
  };

  private onWindowOffline = () => {
    console.warn("Window offline...");
  };

  public getLoginItemSettings(): Promise<LoginItemSettings> {
    return this.invoke(IPC_GET_LOGIN_ITEM_SETTINGS);
  }

  public setLoginItemSettings(settings: Settings): Promise<void> {
    return this.invoke(IPC_SET_LOGIN_ITEM_SETTINGS, settings);
  }

  public async getAppOptions(): Promise<AppOptions> {
    const launchArgs = await this.invoke(IPC_GET_LAUNCH_ARGS);
    return (<any>minimist(launchArgs.slice(1), {
      boolean: ["hidden", "quit"],
    })) as AppOptions;
  }

  public onRendererEvent(channel: MainChannels, listener: (event: IpcRendererEvent, ...args: any[]) => void): void {
    window.wowup.onRendererEvent(channel, listener);
  }

  public async getLocale(): Promise<string> {
    const locale = await this.invoke<string>(IPC_GET_LOCALE);
    return locale.split("-")[0];
  }

  public getVersionNumber(): Promise<string> {
    return this.invoke(IPC_GET_APP_VERSION);
  }

  public async minimizeWindow(): Promise<void> {
    await this.invoke(IPC_MINIMIZE_WINDOW);
  }

  public async maximizeWindow(): Promise<void> {
    await this.invoke(IPC_MAXIMIZE_WINDOW);
  }

  public async unmaximizeWindow(): Promise<void> {
    await this.invoke(IPC_MAXIMIZE_WINDOW);
  }

  public async restartApplication(): Promise<void> {
    await this.invoke(IPC_RESTART_APP);
  }

  public async quitApplication(): Promise<void> {
    await this.invoke(IPC_QUIT_APP);
  }

  public async closeWindow(): Promise<void> {
    await this.invoke(IPC_CLOSE_WINDOW);
  }

  public async leaveFullScreen(): Promise<void> {
    await this.invoke(IPC_WINDOW_LEAVE_FULLSCREEN);
  }

  public showNotification(title: string, options?: NotificationOptions): Notification {
    return new Notification(title, options);
  }

  public isHandlingProtocol(protocol: string): boolean {
    return window.wowup.isDefaultProtocolClient(protocol);
  }

  public setHandleProtocol(protocol: string, enable: boolean): boolean {
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
  ): any {
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

  public async invoke<T = any>(channel: RendererChannels, ...args: any[]): Promise<T> {
    return await window.wowup.rendererInvoke(channel, ...args);
  }

  public on(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): void {
    window.wowup.rendererOn(channel, listener);
  }

  public off(event: string | symbol, listener: (...args: any[]) => void): void {
    window.wowup.rendererOff(event, listener);
  }

  public send(channel: string, ...args: any[]): void {
    window.wowup.rendererSend(channel, ...args);
  }

  public openExternal(url: string, options?: OpenExternalOptions): Promise<void> {
    return window.wowup.openExternal(url, options);
  }

  public openPath(path: string): Promise<string> {
    return window.wowup.openPath(path);
  }

  public applyZoom = async (zoomDirection: ZoomDirection): Promise<void> => {
    switch (zoomDirection) {
      case ZoomDirection.ZoomIn:
        await this.setZoomFactor(await this.getNextZoomInFactor());
        break;
      case ZoomDirection.ZoomOut:
        await this.setZoomFactor(await this.getNextZoomOutFactor());
        break;
      case ZoomDirection.ZoomReset:
        await this.setZoomFactor(1.0);
        break;
      case ZoomDirection.ZoomUnknown:
      default:
        break;
    }
  };

  public setZoomFactor = async (zoomFactor: number): Promise<void> => {
    await this.invoke(IPC_SET_ZOOM_FACTOR, zoomFactor);
    this._zoomFactorChangeSrc.next(zoomFactor);
    this._preferenceStorageService.set(ZOOM_FACTOR_KEY, zoomFactor);
  };

  public getZoomFactor(): Promise<number> {
    return this.invoke(IPC_GET_ZOOM_FACTOR);
  }

  private async getNextZoomInFactor(): Promise<number> {
    const windowZoomFactor = await this.getZoomFactor();
    const zoomFactor = Math.round(windowZoomFactor * 100) / 100;
    let zoomIndex = ZOOM_SCALE.indexOf(zoomFactor);
    if (zoomIndex == -1) {
      return 1.0;
    }
    zoomIndex = Math.min(zoomIndex + 1, ZOOM_SCALE.length - 1);
    return ZOOM_SCALE[zoomIndex];
  }

  private async getNextZoomOutFactor(): Promise<number> {
    const windowZoomFactor = await this.getZoomFactor();
    const zoomFactor = Math.round(windowZoomFactor * 100) / 100;
    let zoomIndex = ZOOM_SCALE.indexOf(zoomFactor);
    if (zoomIndex == -1) {
      return 1.0;
    }
    zoomIndex = Math.max(zoomIndex - 1, 0);
    return ZOOM_SCALE[zoomIndex];
  }
}
