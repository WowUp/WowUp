import { app, clipboard, dialog, OpenDialogOptions, Settings, shell, systemPreferences } from "electron";

import {
  IPC_GET_APP_VERSION,
  IPC_GET_ASSET_FILE_PATH,
  IPC_GET_LAUNCH_ARGS,
  IPC_GET_LOCALE,
  IPC_GET_LOGIN_ITEM_SETTINGS,
  IPC_GET_PENDING_OPEN_URLS,
  IPC_GET_SHELL_VERSION,
  IPC_IS_DEFAULT_PROTOCOL_CLIENT,
  IPC_OW_IS_CMP_REQUIRED,
  IPC_OW_OPEN_CMP,
  IPC_QUIT_APP,
  IPC_REMOVE_AS_DEFAULT_PROTOCOL_CLIENT,
  IPC_RESTART_APP,
  IPC_SET_AS_DEFAULT_PROTOCOL_CLIENT,
  IPC_SET_LOGIN_ITEM_SETTINGS,
  IPC_SHOW_DIRECTORY,
  IPC_SHOW_OPEN_DIALOG,
  IPC_SYSTEM_PREFERENCES_GET_USER_DEFAULT,
  IPC_UPDATE_APP_BADGE,
} from "../../src/common/constants";
import {
  isDefaultProtocolClient,
  removeAsDefaultProtocolClient,
  setAsDefaultProtocolClient,
} from "../../../wowup-shell/contract/protocol-client";
import { getShell } from "../../../wowup-shell/contract/shell-api";
import { getAssetPath } from "../bundle-paths";
import { ipcHandle, IpcController } from "./ipc-controller";

type UserDefaultType = "string" | "boolean" | "integer" | "float" | "double" | "url" | "array" | "dictionary";

export interface AppControllerLogger {
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/** App-wide os integration: versions, login item, protocol client, dialogs, shell, clipboard, quitting */
export class AppController implements IpcController {
  public constructor(
    private readonly _takePendingOpenUrls: () => string[],
    private readonly _log: AppControllerLogger,
  ) {}

  public register(): void {
    // The app's version is the loaded bundle's; app.getVersion() is the installed shell's
    ipcHandle(IPC_GET_APP_VERSION, () => getShell().bundle.version);
    ipcHandle(IPC_GET_SHELL_VERSION, () => app.getVersion());
    ipcHandle(IPC_GET_LOCALE, () => `${app.getLocale()}`);
    ipcHandle(IPC_GET_LAUNCH_ARGS, () => process.argv);
    ipcHandle(IPC_GET_PENDING_OPEN_URLS, () => this._takePendingOpenUrls());
    ipcHandle(IPC_GET_ASSET_FILE_PATH, (_evt, fileName: string) => getAssetPath(fileName));
    ipcHandle(IPC_SYSTEM_PREFERENCES_GET_USER_DEFAULT, (_evt, key: string, type: UserDefaultType) =>
      systemPreferences.getUserDefault(key, type),
    );

    ipcHandle(IPC_GET_LOGIN_ITEM_SETTINGS, () => app.getLoginItemSettings());
    ipcHandle(IPC_SET_LOGIN_ITEM_SETTINGS, (_evt, settings: Settings) => {
      this._log.info("[LoginItemSettings]", settings);
      app.setLoginItemSettings(settings);
    });
    ipcHandle(IPC_IS_DEFAULT_PROTOCOL_CLIENT, (_evt, protocol: string) => isDefaultProtocolClient(protocol));
    ipcHandle(IPC_SET_AS_DEFAULT_PROTOCOL_CLIENT, (_evt, protocol: string) => setAsDefaultProtocolClient(protocol));
    ipcHandle(IPC_REMOVE_AS_DEFAULT_PROTOCOL_CLIENT, (_evt, protocol: string) =>
      removeAsDefaultProtocolClient(protocol),
    );
    ipcHandle(IPC_UPDATE_APP_BADGE, (_evt, count: number) => app.setBadgeCount(count));

    ipcHandle(IPC_SHOW_OPEN_DIALOG, (_evt, options: OpenDialogOptions) => dialog.showOpenDialog(options));
    ipcHandle(IPC_SHOW_DIRECTORY, (_evt, dirPath: string) => shell.openPath(dirPath));
    ipcHandle("show-item-in-folder", (_evt, itemPath: string) => shell.showItemInFolder(itemPath));
    ipcHandle("clipboard-read-text", () => clipboard.readText());
    ipcHandle("base64-encode", (_evt, content: string) => Buffer.from(content).toString("base64"));
    ipcHandle("base64-decode", (_evt, content: string) => Buffer.from(content, "base64").toString("utf-8"));

    ipcHandle(IPC_RESTART_APP, () => {
      this._log.info(`[RestartApp]`);
      app.relaunch();
      app.quit();
    });
    ipcHandle(IPC_QUIT_APP, () => {
      this._log.info(`[QuitApp]`);
      app.quit();
    });

    // Overwolf's consent window. `app.overwolf` only exists on the ow flavor, which is the only
    // one whose renderer asks. NOTE(twolf): Next version of the ow-electron will fix the types
    ipcHandle(IPC_OW_IS_CMP_REQUIRED, async (): Promise<boolean> => {
      try {
        return await (app as any).overwolf.isCMPRequired();
      } catch (e) {
        this._log.error("IPC_OW_IS_CMP_REQUIRED failed", e);
        return false;
      }
    });
    ipcHandle(IPC_OW_OPEN_CMP, (_evt, cmpTab?: string) => {
      const options = {} as any;
      if (cmpTab) {
        options.tab = cmpTab;
      }

      (app as any).overwolf.openCMPWindow(options);
    });
  }
}
