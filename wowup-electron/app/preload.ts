// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../src/common/wowup.d.ts" />

import { ipcRenderer, IpcRendererEvent, shell, OpenExternalOptions } from "electron";
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

function getArg(argKey: string): string {
  for (const arg of window.process.argv) {
    const [key, val] = arg.split("=");
    if (key === `--${argKey}`) {
      return val;
    }
  }

  throw new Error(`Arg not found: ${argKey}`);
}

const LOG_PATH = getArg("log-path");
const USER_DATA_PATH = getArg("user-data-path");
const BASE_BG_COLOR = getArg("base-bg-color");

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
  /* eslint-disable @typescript-eslint/no-unsafe-argument */
  ipcRenderer.send(channel, ...args);
  /* eslint-enable @typescript-eslint/no-unsafe-argument */
}

function rendererSendSync(channel: string, ...args: any[]): any {
  /* eslint-disable @typescript-eslint/no-unsafe-argument */
  return ipcRenderer.sendSync(channel, ...args);
  /* eslint-enable @typescript-eslint/no-unsafe-argument */
}

function rendererInvoke(channel: string, ...args: any[]): Promise<any> {
  /* eslint-disable @typescript-eslint/no-unsafe-argument */
  return ipcRenderer.invoke(channel, ...args);
  /* eslint-enable @typescript-eslint/no-unsafe-argument */
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

window.addEventListener("auxclick", (event) => {
  event.preventDefault();
});

try {
  if (window.opener === null) {
    window.log = log;
    window.baseBgColor = BASE_BG_COLOR;
    window.libs = {
      handlebars: require("handlebars"),
      autoLaunch: require("auto-launch"),
    };
    window.userDataPath = USER_DATA_PATH;
    window.logPath = LOG_PATH;
    window.platform = process.platform;
    window.wowup = {
      onRendererEvent,
      onceRendererEvent,
      rendererSend,
      rendererSendSync,
      rendererInvoke,
      rendererOff,
      rendererOn,
      openExternal,
      openPath,
    };
  } else {
    console.log("HAS OPENER");
  }
} catch (e) {
  log.error(e);
}
