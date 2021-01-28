import {
  IpcRendererEvent,
  LoginItemSettings,
  WebContents,
  Settings,
  LoginItemSettingsOptions,
  OpenExternalOptions,
  OpenDialogOptions,
  OpenDialogReturnValue,
} from "electron";
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
  | "power-monitor-unlock";

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
  | "readdir";

declare global {
  interface Window {
    log: ElectronLog;
    libs: {
      handlebars: any;
      autoLaunch: any;
    };
    wowup: {
      onRendererEvent: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => void;
      onceRendererEvent: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => void;
      rendererSend: (channel: string, ...args: any[]) => void;
      rendererInvoke: (channel: string, ...args: any[]) => Promise<any>;
      rendererOff: (event: string | symbol, listener: (...args: any[]) => void) => void;
      rendererOn: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => void;
      isDefaultProtocolClient: (protocol: string, path?: string, args?: string[]) => boolean;
      setAsDefaultProtocolClient: (protocol: string, path?: string, args?: string[]) => boolean;
      removeAsDefaultProtocolClient: (protocol: string, path?: string, args?: string[]) => boolean;
      openExternal: (url: string, options?: OpenExternalOptions) => Promise<void>;
      showOpenDialog: (options: OpenDialogOptions) => Promise<OpenDialogReturnValue>;
      openPath: (path: string) => Promise<string>;
      systemPreferences: {
        getUserDefault: (
          key: string,
          type: "string" | "boolean" | "integer" | "float" | "double" | "url" | "array" | "dictionary"
        ) => any;
      };
    };
  }
}
