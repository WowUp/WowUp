// If you import a module but never use any of the imported values other than as TypeScript types,
// the resulting javascript file will look as if you never imported the module at all.
import { IpcRendererEvent, OpenDialogOptions, OpenDialogReturnValue, OpenExternalOptions, Settings } from "electron";
import { LoginItemSettings } from "electron/main";
import { find } from "lodash";
import * as minimist from "minimist";
import { BehaviorSubject, ReplaySubject, Subject } from "rxjs";
import { v4 as uuidv4 } from "uuid";

import { Injectable } from "@angular/core";

import {
  IPC_APP_UPDATE_STATE,
  IPC_CLOSE_WINDOW,
  IPC_CUSTOM_PROTOCOL_RECEIVED,
  IPC_FOCUS_WINDOW,
  IPC_GET_APP_VERSION,
  IPC_GET_LAUNCH_ARGS,
  IPC_GET_LOCALE,
  IPC_GET_LOGIN_ITEM_SETTINGS,
  IPC_GET_PENDING_OPEN_URLS,
  IPC_IS_DEFAULT_PROTOCOL_CLIENT,
  IPC_MAXIMIZE_WINDOW,
  IPC_MINIMIZE_WINDOW,
  IPC_POWER_MONITOR_LOCK,
  IPC_POWER_MONITOR_RESUME,
  IPC_POWER_MONITOR_SUSPEND,
  IPC_POWER_MONITOR_UNLOCK,
  IPC_QUIT_APP,
  IPC_REMOVE_AS_DEFAULT_PROTOCOL_CLIENT,
  IPC_RESTART_APP,
  IPC_SET_AS_DEFAULT_PROTOCOL_CLIENT,
  IPC_SET_LOGIN_ITEM_SETTINGS,
  IPC_SET_ZOOM_LIMITS,
  IPC_SHOW_OPEN_DIALOG,
  IPC_SYSTEM_PREFERENCES_GET_USER_DEFAULT,
  IPC_WINDOW_LEAVE_FULLSCREEN,
  IPC_WINDOW_MAXIMIZED,
  IPC_WINDOW_MINIMIZED,
  IPC_WINDOW_RESUME,
  IPC_WINDOW_UNMAXIMIZED,
} from "../../../common/constants";
import { IpcRequest } from "../../../common/models/ipc-request";
import { IpcResponse } from "../../../common/models/ipc-response";
import { ValueRequest } from "../../../common/models/value-request";
import { ValueResponse } from "../../../common/models/value-response";
import { MainChannels } from "../../../common/wowup";
import { AppOptions, AppUpdateEvent } from "../../../common/wowup/models";
import { isProtocol } from "../../utils/string.utils";

@Injectable({
  providedIn: "root",
})
export class ElectronService {
  private readonly _windowMaximizedSrc = new BehaviorSubject(false);
  private readonly _windowMinimizedSrc = new BehaviorSubject(false);
  private readonly _powerMonitorSrc = new BehaviorSubject("");
  private readonly _customProtocolSrc = new BehaviorSubject("");
  private readonly _appUpdateSrc = new ReplaySubject<AppUpdateEvent>();
  private readonly _windowResumedSrc = new Subject<void>();
  private readonly _windowFocusedSrc = new BehaviorSubject<boolean>(true);

  private _appVersion = "";
  private _opts!: AppOptions;

  public readonly windowMaximized$ = this._windowMaximizedSrc.asObservable();
  public readonly windowMinimized$ = this._windowMinimizedSrc.asObservable();
  public readonly powerMonitor$ = this._powerMonitorSrc.asObservable();
  public readonly customProtocol$ = this._customProtocolSrc.asObservable();
  public readonly appUpdate$ = this._appUpdateSrc.asObservable();
  public readonly windowResumed$ = this._windowResumedSrc.asObservable();
  public readonly windowFocused$ = this._windowFocusedSrc.asObservable();
  public readonly isWin = process.platform === "win32";
  public readonly isMac = process.platform === "darwin";
  public readonly isLinux = process.platform === "linux";
  public readonly isPortable = !!process.env.PORTABLE_EXECUTABLE_DIR;

  public get isElectron(): boolean {
    return !!(window && window.process && window.process.type);
  }

  public get platform(): string {
    return process.platform;
  }

  public constructor() {
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

    this.onRendererEvent(IPC_APP_UPDATE_STATE, (evt, updateEvt: AppUpdateEvent) => {
      console.log("IPC_APP_UPDATE_STATE", IPC_APP_UPDATE_STATE);
      console.log(updateEvt);
      this._appUpdateSrc.next(updateEvt);
    });

    this.onRendererEvent(IPC_WINDOW_MINIMIZED, () => {
      this._windowMinimizedSrc.next(true);
    });

    this.onRendererEvent(IPC_WINDOW_RESUME, () => {
      this._windowResumedSrc.next(undefined);
    });

    this.onRendererEvent(IPC_WINDOW_MAXIMIZED, () => {
      this._windowMaximizedSrc.next(true);
    });

    this.onRendererEvent(IPC_WINDOW_UNMAXIMIZED, () => {
      this._windowMaximizedSrc.next(false);
    });

    this.onRendererEvent("blur", () => {
      this._windowFocusedSrc.next(false);
    });

    this.onRendererEvent("focus", () => {
      this._windowFocusedSrc.next(true);
    });

    this.onRendererEvent(IPC_CUSTOM_PROTOCOL_RECEIVED, (evt, protocol: string) => {
      this._customProtocolSrc.next(protocol);
    });

    this.onRendererEvent(IPC_POWER_MONITOR_LOCK, () => {
      console.log("POWER_MONITOR_LOCK received", `navigator.onLine: ${navigator.onLine.toString()}`);
      this._powerMonitorSrc.next(IPC_POWER_MONITOR_LOCK);
    });

    this.onRendererEvent(IPC_POWER_MONITOR_UNLOCK, () => {
      console.log("POWER_MONITOR_UNLOCK received", `navigator.onLine: ${navigator.onLine.toString()}`);
      this._powerMonitorSrc.next(IPC_POWER_MONITOR_UNLOCK);
    });

    this.onRendererEvent(IPC_POWER_MONITOR_SUSPEND, () => {
      console.log("POWER_MONITOR_SUSPEND received", `navigator.onLine: ${navigator.onLine.toString()}`);
      this._powerMonitorSrc.next(IPC_POWER_MONITOR_SUSPEND);
    });

    this.onRendererEvent(IPC_POWER_MONITOR_RESUME, () => {
      console.log("POWER_MONITOR_RESUME received", `navigator.onLine: ${navigator.onLine.toString()}`);
      this._powerMonitorSrc.next(IPC_POWER_MONITOR_RESUME);
    });

    this.invoke(IPC_SET_ZOOM_LIMITS, 1, 1).catch((e) => {
      console.error("Failed to set zoom limits", e);
    });

    this.isWindowFocused()
      .then((focused) => {
        this._windowFocusedSrc.next(focused);
      })
      .catch(console.error);
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

  public isDefaultProtocolClient(protocol: string): Promise<boolean> {
    return this.invoke(IPC_IS_DEFAULT_PROTOCOL_CLIENT, protocol);
  }

  public setAsDefaultProtocolClient(protocol: string): Promise<boolean> {
    return this.invoke(IPC_SET_AS_DEFAULT_PROTOCOL_CLIENT, protocol);
  }

  public async removeAsDefaultProtocolClient(protocol: string): Promise<boolean> {
    return this.invoke(IPC_REMOVE_AS_DEFAULT_PROTOCOL_CLIENT, protocol);
  }

  // Check for any URLs that were available at app launch on Mac
  public async processPendingOpenUrls(): Promise<void> {
    const pendingUrls: string[] = await this.invoke(IPC_GET_PENDING_OPEN_URLS);
    for (const pendingUrl of pendingUrls) {
      if (isProtocol(pendingUrl)) {
        // If we did get a custom protocol notify the app
        this._customProtocolSrc.next(pendingUrl);
      }
    }
  }

  public async getAppOptions(): Promise<AppOptions> {
    if (!this._opts) {
      console.debug("getAppOptions");
      // TODO check protocols here
      const launchArgs = await this.invoke<string[]>(IPC_GET_LAUNCH_ARGS);
      this._opts = (<any>minimist(launchArgs.slice(1), {
        boolean: ["hidden", "quit"],
        string: ["install"],
      })) as AppOptions;

      // Find the first protocol arg if any exist
      const customProtocol = find(launchArgs, (arg) => isProtocol(arg));
      if (customProtocol) {
        // If we did get a custom protocol notify the app
        this._customProtocolSrc.next(customProtocol);
      }
    }

    return this._opts;
  }

  public onRendererEvent(channel: MainChannels, listener: (event: IpcRendererEvent, ...args: any[]) => void): void {
    window.wowup?.onRendererEvent(channel, listener);
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

  public async isWindowFocused(): Promise<boolean> {
    return await this.invoke("get-focus");
  }

  public async readClipboardText(): Promise<string> {
    return await this.invoke("clipboard-read-text");
  }

  public showNotification(title: string, options?: NotificationOptions): Notification {
    return new Notification(title, options);
  }

  public async showOpenDialog(options: OpenDialogOptions): Promise<OpenDialogReturnValue> {
    return await this.invoke(IPC_SHOW_OPEN_DIALOG, options);
  }

  public async showItemInFolder(path: string): Promise<void> {
    return await this.invoke("show-item-in-folder", path);
  }

  public async getUserDefaultSystemPreference<T = any>(
    key: string,
    type: "string" | "boolean" | "integer" | "float" | "double" | "url" | "array" | "dictionary"
  ): Promise<T> {
    return await this.invoke(IPC_SYSTEM_PREFERENCES_GET_USER_DEFAULT, key, type);
  }

  public async sendIpcValueMessage<TIN, TOUT>(channel: string, value: TIN): Promise<TOUT> {
    const request: ValueRequest<TIN> = {
      value,
      responseKey: uuidv4(),
    };

    const response = await this.sendIPCMessage<ValueRequest<TIN>, ValueResponse<TOUT>>(channel, request);

    return response.value;
  }

  public focusWindow(): Promise<void> {
    return this.invoke(IPC_FOCUS_WINDOW);
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

  public async invoke<T = any>(channel: string, ...args: any[]): Promise<T> {
    try {
      /* eslint-disable @typescript-eslint/no-unsafe-argument */
      return await window.wowup.rendererInvoke(channel, ...args);
      /* eslint-enable @typescript-eslint/no-unsafe-argument */
    } catch (e) {
      console.error("Invoke failed", e);
      throw e;
    }
  }

  public sendSync<T>(channel: string, ...args: any[]): T {
    /* eslint-disable @typescript-eslint/no-unsafe-argument */
    return window.wowup.rendererSendSync(channel, ...args) as T;
    /* eslint-enable @typescript-eslint/no-unsafe-argument */
  }

  public on(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): void {
    window.wowup.rendererOn(channel, listener);
  }

  public off(channel: string, listener: (...args: any[]) => void): void {
    window.wowup.rendererOff(channel, listener);
  }

  public send(channel: string, ...args: any[]): void {
    /* eslint-disable @typescript-eslint/no-unsafe-argument */
    window.wowup.rendererSend(channel, ...args);
    /* eslint-enable @typescript-eslint/no-unsafe-argument */
  }

  public openExternal(url: string, options?: OpenExternalOptions): Promise<void> {
    return window.wowup.openExternal(url, options);
  }

  public openPath(path: string): Promise<string> {
    return window.wowup.openPath(path);
  }
}
