/// <reference path="./src/common/wowup.d.ts" />

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

if (!process.isMainFrame) {
  throw new Error("Preload scripts should not be running in a subframe");
}

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

function isDefaultProtocolClient(protocol: string, path?: string, args?: string[]) {
  return remote.app.isDefaultProtocolClient(protocol, path, args);
}

function setAsDefaultProtocolClient(protocol: string, path?: string, args?: string[]) {
  return remote.app.setAsDefaultProtocolClient(protocol, path, args);
}

function removeAsDefaultProtocolClient(protocol: string, path?: string, args?: string[]) {
  return remote.app.removeAsDefaultProtocolClient(protocol, path, args);
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
  console.log("NO OPENER");
  window.log = log;
  window.libs = {
    handlebars: require("handlebars"),
    autoLaunch: require("auto-launch"),
  };
  window.wowup = {
    onRendererEvent,
    onceRendererEvent,
    rendererSend,
    rendererInvoke,
    rendererOff,
    rendererOn,
    isDefaultProtocolClient,
    setAsDefaultProtocolClient,
    removeAsDefaultProtocolClient,
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
