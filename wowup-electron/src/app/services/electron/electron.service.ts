import { Injectable } from '@angular/core';

// If you import a module but never use any of the imported values other than as TypeScript types,
// the resulting javascript file will look as if you never imported the module at all.
import { ipcRenderer, webFrame, remote, shell } from 'electron';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
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

  constructor() {
    // Conditional imports
    if (!this.isElectron) {
      return;
    }
    this.ipcRenderer = window.require('electron').ipcRenderer;
    this.webFrame = window.require('electron').webFrame;
    this.remote = window.require('electron').remote;
    this.shell = window.require('electron').shell;

    this.childProcess = window.require('child_process');
    this.fs = window.require('fs');

    this.remote.getCurrentWindow().on('minimize', () => {
      this._windowMinimizedSrc.next(true);
    });

    this.remote.getCurrentWindow().on('restore', () => {
      this._windowMinimizedSrc.next(false);
    });

    this.remote.getCurrentWindow().on('maximize', () => {
      this._windowMaximizedSrc.next(true);
    });

    this.remote.getCurrentWindow().on('unmaximize', () => {
      this._windowMaximizedSrc.next(false);
    });
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
}
