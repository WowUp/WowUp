import { Injectable } from "@angular/core";
import { v4 as uuidv4 } from "uuid";

// If you import a module but never use any of the imported values other than as TypeScript types,
// the resulting javascript file will look as if you never imported the module at all.
import { ipcRenderer, webFrame, remote, shell } from "electron";
import * as childProcess from "child_process";
import * as fs from "fs";
import { BehaviorSubject } from "rxjs";
import { ValueResponse } from "common/models/value-response";
import { ValueRequest } from "common/models/value-request";

@Injectable({
  providedIn: "root",
})
export class ElectronService {
  private readonly _windowMaximizedSrc = new BehaviorSubject(false);
  private readonly _windowMinimizedSrc = new BehaviorSubject(false);

  ipcRenderer: typeof ipcRenderer;
  webFrame: typeof webFrame;
  remote: typeof remote;
  shell: typeof shell;
  childProcess: typeof childProcess;
  fs: typeof fs;

  public readonly windowMaximized$ = this._windowMaximizedSrc.asObservable();
  public readonly windowMinimized$ = this._windowMinimizedSrc.asObservable();
  public readonly isWin = process.platform === "win32";
  public readonly isMac = process.platform === "darwin";

  get isElectron(): boolean {
    return !!(window && window.process && window.process.type);
  }

  get locale(): string {
    return this.remote.app.getLocale().split("-")[0];
  }

  constructor() {
    // Conditional imports
    if (!this.isElectron) {
      return;
    }
    this.ipcRenderer = window.require("electron").ipcRenderer;
    this.webFrame = window.require("electron").webFrame;
    this.remote = window.require("electron").remote;
    this.shell = window.require("electron").shell;

    this.childProcess = window.require("child_process");
    this.fs = window.require("fs");

    this.remote.getCurrentWindow().on("minimize", () => {
      this._windowMinimizedSrc.next(true);
    });

    this.remote.getCurrentWindow().on("restore", () => {
      this._windowMinimizedSrc.next(false);
    });

    this.remote.getCurrentWindow().on("maximize", () => {
      this._windowMaximizedSrc.next(true);
    });

    this.remote.getCurrentWindow().on("unmaximize", () => {
      this._windowMaximizedSrc.next(false);
    });

    this._windowMaximizedSrc.next(this.remote.getCurrentWindow().isMaximized());
  }

  minimizeWindow() {
    this.remote.getCurrentWindow().minimize();
  }

  maximizeWindow() {
    this.remote.getCurrentWindow().maximize();
  }

  unmaximizeWindow() {
    this.remote.getCurrentWindow().unmaximize();
  }

  hideWindow() {
    this.remote.getCurrentWindow().hide();
  }

  closeWindow() {
    this.remote.getCurrentWindow().close();
    this.remote.app.quit();
  }

  public showNotification(title: string, options?: NotificationOptions) {
    const myNotification = new Notification(title, options);
  }

  public sendIpcValueMessage<TIN, TOUT>(
    channel: string,
    value: TIN
  ): Promise<TOUT> {
    return new Promise((resolve, reject) => {
      const eventHandler = (_evt: any, arg: ValueResponse<TOUT>) => {
        if (arg.error) {
          return reject(arg.error);
        }

        resolve(arg.value);
      };

      const request: ValueRequest<TIN> = {
        value,
        responseKey: uuidv4(),
      };

      this.ipcRenderer.once(request.responseKey, eventHandler);
      this.ipcRenderer.send(channel, request);
    });
  }
}
