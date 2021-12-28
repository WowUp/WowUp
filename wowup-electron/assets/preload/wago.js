const { contextBridge, ipcRenderer } = require("electron");
const log = require("electron-log");
const { join } = require("path");

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

contextBridge.exposeInMainWorld("wago", {
  provideApiKey: (key) => {
    log.debug(`[wago-preload] got key`, key);
    ipcRenderer.send("wago-token-received", key);
  },
});

setTimeout(() => {
  log.info(`[wago-preload] setTimeout reloading`);
  window.location.reload();
}, RELOAD_PERIOD_MS);

log.info(`[wago-preload] init`);
log.info(`[wago-preload] next reload`, new Date(Date.now() + RELOAD_PERIOD_MS).toLocaleString());
