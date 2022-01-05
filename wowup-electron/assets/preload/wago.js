const { contextBridge, ipcRenderer } = require("electron");
const log = require("electron-log");
const { join } = require("path");
const { inspect } = require("util");

const RELOAD_PERIOD_MS = 10 * 60 * 1000;
const LOG_PATH = getArg("log-path");

function getArg(argKey) {
  for (const arg of window.process.argv) {
    const [key, val] = arg.split("=");
    if (key === `--${argKey}`) {
      return val;
    }
  }

  throw new Error(`Arg not found: ${argKey}`);
}

log.transports.file.resolvePath = (variables) => {
  return join(LOG_PATH, variables.fileName);
};

/* eslint-disable @typescript-eslint/no-unsafe-argument */
console.log = function (...data) {
  log.info(...data);
};
console.warn = function (...data) {
  log.warn(...data);
};
console.error = function (...data) {
  log.error(...data);
};
/* eslint-enable @typescript-eslint/no-unsafe-argument */

contextBridge.exposeInMainWorld("wago", {
  provideApiKey: (key) => {
    console.debug(`[wago-preload] got key`);
    ipcRenderer.send("wago-token-received", key);
  },
});

setTimeout(() => {
  console.info(`[wago-preload] setTimeout reloading`);
  window.location.reload();
}, RELOAD_PERIOD_MS);

console.info(`[wago-preload] init`);
console.info(`[wago-preload] next reload`, new Date(Date.now() + RELOAD_PERIOD_MS).toLocaleString());

document.addEventListener("click", (evt) => {
  if (evt.target.href) {
    console.info("[wago] ad click", evt.target.href, evt.target.target);
    if (evt.target.target === "_blank") {
      console.info(`[wago] ad requests window`);
      // TODO forward this up to the 3rd party consent confirmation box
    }
  }
});

window.addEventListener(
  "error",
  function (e) {
    const errMsg = e.error?.toString() || "unknown error on " + window.location;
    console.error(`[wago-preload] error listener:`, errMsg);
    ipcRenderer.send("webview-error", inspect(e.error), e.message);
  },
  true
);

window.onerror = function (msg, url, lineNo, columnNo, error) {
  console.error(`[wago-preload] error:`, msg, url, lineNo, columnNo, error);
  return false;
};
