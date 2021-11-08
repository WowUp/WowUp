import { IpcRendererEvent, OpenExternalOptions } from "electron";
import { ElectronLog } from "electron-log";

// Events that can be sent from main to renderer
declare type MainChannels =
  | "zoom-changed"
  | "app-update-check-start"
  | "app-update-check-end"
  | "app-update-start-download"
  | "app-update-downloaded"
  | "app-update-not-available"
  | "window-minimized"
  | "window-unmaximized"
  | "window-maximized"
  | "power-monitor-resume"
  | "power-monitor-suspend"
  | "power-monitor-lock"
  | "power-monitor-unlock"
  | "request-install-from-url"
  | "custom-protocol-received"
  | "app-update-state"
  | "window-resume"
  | "push-notification";

// Events that can be sent from renderer to main
declare type RendererChannels =
  | "get-zoom-factor"
  | "set-zoom-factor"
  | "set-zoom-limits"
  | "minimize-window"
  | "maximize-window"
  | "show-directory"
  | "get-asset-file-path"
  | "create-directory"
  | "list-directories"
  | "stat-files"
  | "path-exists"
  | "curse-get-scan-results"
  | "wowup-get-scan-results"
  | "unzip-file"
  | "zip-file"
  | "zip-read-file"
  | "copy-file"
  | "delete-directory"
  | "list-disks-win32"
  | "quit-app"
  | "restart-app"
  | "close-window"
  | "create-app-menu"
  | "create-tray-menu"
  | "write-file"
  | "read-file"
  | "rename-file"
  | "get-app-version"
  | "app-update-check-for-update"
  | "app-update-start-download"
  | "app-update-install"
  | "get-locale"
  | "get-launch-args"
  | "get-login-item-settings"
  | "set-login-item-settings"
  | "leave-full-screen"
  | "list-entries"
  | "list-files"
  | "readdir"
  | "is-default-protocol-client"
  | "set-as-default-protocol-client"
  | "remove-as-default-protocol-client"
  | "read-file-buffer"
  | "addons-save-all"
  | "focus-window"
  | "get-pending-open-urls"
  | "store-get-object"
  | "store-set-object"
  | "get-latest-dir-update-time"
  | "system-preferences-get-user-default"
  | "show-open-dialog"
  | "app-install-update"
  | "update-app-badge"
  | "list-dir-recursive"
  | "get-directory-tree"
  | "push-init"
  | "push-register"
  | "push-unregister"
  | "push-subscribe"
  | "clipboard-read-text"
  | "show-item-in-folder"
  | "base64-encode"
  | "base64-decode";

declare global {
  interface Window {
    log: ElectronLog;
    libs: {
      handlebars: any;
      autoLaunch: any;
    };
    baseBgColor: string;
    platform: string;
    userDataPath: string;
    logPath: string;
    wowup: {
      onRendererEvent: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => void;
      onceRendererEvent: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => void;
      rendererSend: (channel: string, ...args: any[]) => void;
      rendererInvoke: (channel: string, ...args: any[]) => Promise<any>;
      rendererOff: (event: string | symbol, listener: (...args: any[]) => void) => void;
      rendererOn: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => void;
      openExternal: (url: string, options?: OpenExternalOptions) => Promise<void>;
      openPath: (path: string) => Promise<string>;
    };
  }
}
