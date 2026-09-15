const { contextBridge, ipcRenderer } = require("electron");

// Keep these channel names in sync with src/common/constants.ts, this file is shipped as a plain
// asset and is not part of the typescript build.
const IPC_WAGO_ADS_CMP_CLOSE = "wago-ads-cmp-close";
const IPC_WEBVIEW_LOG = "webview-log";

function forwardLog(level) {
  return function (...data) {
    ipcRenderer.send(IPC_WEBVIEW_LOG, level, ...data);
  };
}

console.log = forwardLog("info");
console.warn = forwardLog("warn");
console.error = forwardLog("error");

// The consent page calls this once the user has made a choice, or immediately if gdpr does not
// apply to them. Without it a frameless window cannot get itself closed.
contextBridge.exposeInMainWorld("electronAPI", {
  closeCMP: () => ipcRenderer.send(IPC_WAGO_ADS_CMP_CLOSE),
  console: forwardLog("info"),
});

console.log("[cmp-preload] init", window.location.href);
