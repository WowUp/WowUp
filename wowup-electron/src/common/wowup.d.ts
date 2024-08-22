import { IpcRendererEvent, OpenExternalOptions } from "electron";

// Events that can be sent from main to renderer
declare type MainChannels =
  | "app-update-check-start"
  | "app-update-check-end"
  | "app-update-downloaded"
  | "app-update-not-available"
  | "app-update-start-download"
  | "app-update-state"
  | "blur"
  | "custom-protocol-received"
  | "focus"
  | "power-monitor-lock"
  | "power-monitor-resume"
  | "power-monitor-suspend"
  | "power-monitor-unlock"
  | "push-notification"
  | "request-install-from-url"
  | "window-maximized"
  | "window-minimized"
  | "window-unmaximized"
  | "window-resume"
  | "zoom-changed";

// Events that can be sent from renderer to main
declare type RendererChannels =
  | "addons-save-all"
  | "app-install-update"
  | "app-update-check-for-update"
  | "app-update-install"
  | "app-update-start-download"
  | "base64-decode"
  | "base64-encode"
  | "clipboard-read-text"
  | "close-window"
  | "copy-file"
  | "create-app-menu"
  | "create-directory"
  | "create-tray-menu"
  | "curse-get-scan-results"
  | "decode-product-db"
  | "delete-directory"
  | "focus-window"
  | "get-app-version"
  | "get-asset-file-path"
  | "get-directory-tree"
  | "get-focus"
  | "get-home-dir"
  | "get-latest-dir-update-time"
  | "get-launch-args"
  | "get-locale"
  | "get-login-item-settings"
  | "get-pending-open-urls"
  | "get-zoom-factor"
  | "is-default-protocol-client"
  | "leave-full-screen"
  | "list-dir-recursive"
  | "list-directories"
  | "list-disks-win32"
  | "list-entries"
  | "list-files"
  | "maximize-window"
  | "minimize-window"
  | "ow-is-cmp-required"
  | "ow-open-cmp"
  | "path-exists"
  | "push-init"
  | "push-register"
  | "push-subscribe"
  | "push-unregister"
  | "quit-app"
  | "read-file"
  | "read-file-buffer"
  | "readdir"
  | "remove-as-default-protocol-client"
  | "rename-file"
  | "restart-app"
  | "set-as-default-protocol-client"
  | "set-login-item-settings"
  | "set-release-channel"
  | "set-zoom-factor"
  | "set-zoom-limits"
  | "show-directory"
  | "show-item-in-folder"
  | "show-open-dialog"
  | "stat-files"
  | "store-get-all"
  | "store-get-object"
  | "store-remove-object"
  | "store-set-object"
  | "system-preferences-get-user-default"
  | "unzip-file"
  | "update-app-badge"
  | "wago-token-received"
  | "wowup-get-scan-results"
  | "write-file"
  | "zip-file"
  | "zip-read-file"
  | "zip-list-files";

declare global {
  interface Window {
    log;
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
      rendererSendSync: (channel: string, ...args: any[]) => any;
      rendererInvoke: (channel: string, ...args: any[]) => Promise<any>;
      rendererOff: (channel: string, listener: (...args: any[]) => void) => void;
      rendererOn: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => void;
      openExternal: (url: string, options?: OpenExternalOptions) => Promise<void>;
      openPath: (path: string) => Promise<string>;
    };
  }
}
