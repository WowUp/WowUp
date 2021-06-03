// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../src/common/wowup.d.ts" />

import {
  remote,
  ipcRenderer,
  IpcRendererEvent,
  shell,
  OpenExternalOptions,
  OpenDialogOptions,
  OpenDialogReturnValue,
} from "electron";
import * as log from "electron-log";
import { join } from "path";
import * as platform from "./platform";

if (!process.isMainFrame) {
  throw new Error("Preload scripts should not be running in a subframe");
}

if (platform.isWin) {
  const ca = require("win-ca");
  const list: any[] = [];
  ca({
    async: true,
    format: ca.der2.txt,
    ondata: list,
    onend: () => {
      log.info("win-ca loaded");
    },
  });
}

const LOG_PATH = join(remote.app.getPath("userData"), "logs");
log.transports.file.resolvePath = (variables: log.PathVariables) => {
  return join(LOG_PATH, variables.fileName);
};

function onRendererEvent(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) {
  ipcRenderer.on(channel, listener);
}

function onceRendererEvent(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) {
  ipcRenderer.once(channel, listener);
}

function rendererSend(channel: string, ...args: any[]) {
  ipcRenderer.send(channel, ...args);
}

function rendererInvoke(channel: string, ...args: any[]): Promise<any> {
  return ipcRenderer.invoke(channel, ...args);
}

function rendererOff(event: string | symbol, listener: (...args: any[]) => void) {
  ipcRenderer.off(event, listener);
}

function rendererOn(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) {
  ipcRenderer.on(channel, listener);
}

function openExternal(url: string, options?: OpenExternalOptions): Promise<void> {
  return shell.openExternal(url, options);
}

function openPath(path: string): Promise<string> {
  return shell.openPath(path);
}

function getUserDefaultSystemPreference(
  key: string,
  type: "string" | "boolean" | "integer" | "float" | "double" | "url" | "array" | "dictionary"
) {
  return remote.systemPreferences.getUserDefault(key, type);
}

function showOpenDialog(options: OpenDialogOptions): Promise<OpenDialogReturnValue> {
  return remote.dialog.showOpenDialog(options);
}

if (window.opener === null) {
  window.log = log;
  window.libs = {
    handlebars: require("handlebars"),
    autoLaunch: require("auto-launch"),
  };
  window.platform = process.platform;
  window.wowup = {
    onRendererEvent,
    onceRendererEvent,
    rendererSend,
    rendererInvoke,
    rendererOff,
    rendererOn,
    openExternal,
    showOpenDialog,
    openPath,
    systemPreferences: {
      getUserDefault: getUserDefaultSystemPreference,
    },
  };
} else {
  console.log("HAS OPENER");
}
