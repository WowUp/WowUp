const { contextBridge, ipcRenderer } = require("electron");
// const log = require("electron-log");
// const { join } = require("path");
// const { inspect } = require("util");

// const LOG_PATH = getArg("log-path");

const BACKOFF_KEY = "wago-backoff";
const BACKOFF_SET_KEY = "wago-backoff-set";
const BACKOFF_RESET_AGE = 5 * 60000;
const BACKOFF_MAX_WAIT = 2 * 60000;

let keyExpectedTimeout = undefined;

// function getArg(argKey) {
//   for (const arg of window.process.argv) {
//     const [key, val] = arg.split("=");
//     if (key === `--${argKey}`) {
//       return val;
//     }
//   }

//   throw new Error(`Arg not found: ${argKey}`);
// }

// log.transports.file.resolvePath = (variables) => {
//   return join(LOG_PATH, variables.fileName);
// };

// /* eslint-disable @typescript-eslint/no-unsafe-argument */
console.log = function (...data) {
  ipcRenderer.send("webview-log", "info", ...data);
};

console.warn = function (...data) {
  ipcRenderer.send("webview-log", "warn", ...data);
};

console.error = function (...data) {
  ipcRenderer.send("webview-log", "error", ...data);
};
// /* eslint-enable @typescript-eslint/no-unsafe-argument */

window.addEventListener(
  "error",
  function (e) {
    const errMsg = e.error?.toString() || "unknown error on " + window.location;
    console.error(`[wago-preload] error listener:`, e.message, errMsg);
    ipcRenderer.send("webview-error", e.error, e.message);

    if (keyExpectedTimeout != undefined) {
      backoffReload();
    }
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
    keyExpectedTimeout = undefined;
    console.debug(`[wago-preload] got key`);
    ipcRenderer.send("wago-token-received", key);
  },
});

// If the api key does not get populated after a certain time, reload
// Can happen if the page returns bad responses (500 etc)
keyExpectedTimeout = window.setTimeout(() => {
  console.log("[wago-preload] failed to get key in time, reloading");
  backoffReload();
}, 30000);

console.log(`[wago-preload] init`, window.location.href);

function backoffReload() {
  let backoffSet = window.sessionStorage.getItem("wago-backoff-set");
  backoffSet = backoffSet ? parseInt(backoffSet, 10) : 0;

  let backoff = window.sessionStorage.getItem(BACKOFF_KEY);
  backoff = Math.min(backoff ? parseInt(backoff, 10) * 2 : 2000, BACKOFF_MAX_WAIT);

  // If the backoff time is old, reset the backoff
  if (Date.now() - backoffSet > BACKOFF_RESET_AGE) {
    backoff = 2000;
  }

  console.log("[wago] setting reload backoff", backoff);
  window.sessionStorage.setItem(BACKOFF_KEY, backoff);
  window.sessionStorage.setItem(BACKOFF_SET_KEY, Date.now().toString());

  // Wait the calculated time
  window.setTimeout(() => {
    window.location.reload();
  }, backoff);
}
