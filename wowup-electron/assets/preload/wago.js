const { contextBridge, ipcRenderer } = require("electron");
const log = require("electron-log");
const { join } = require("path");
const { inspect } = require("util");

const LOG_PATH = getArg("log-path");

let keyExpectedTimeout = 0;

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

window.addEventListener(
  "error",
  function (e) {
    const errMsg = e.error?.toString() || "unknown error on " + window.location;
    console.error(`[wago-preload] error listener:`, e.message, errMsg);
    ipcRenderer.send("webview-error", inspect(e.error), e.message);
    window.setTimeout(() => window.location.reload(), 2000);
  },
  true
);

window.onerror = function (msg, url, lineNo, columnNo, error) {
  console.error(`[wago-preload] error:`, msg, url, lineNo, columnNo, error);
  return false;
};

contextBridge.exposeInMainWorld("wago", {
  provideApiKey: (key) => {
    window.clearTimeout(keyExpectedTimeout);
    console.debug(`[wago-preload] got key`);
    ipcRenderer.send("wago-token-received", key);
  },
});

// If the api key does not get populated after a certain time, reload
// Can happen if the page returns bad responses (500 etc)
keyExpectedTimeout = window.setTimeout(() => {
  console.log("[wago-preload] failed to get key in time, reloading");
  window.location.reload();
}, 30000);

console.log(`[wago-preload] init`);
