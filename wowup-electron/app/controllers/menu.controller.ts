import type { BrowserWindow } from "electron";

import { IPC_CREATE_APP_MENU_CHANNEL, IPC_CREATE_TRAY_MENU_CHANNEL } from "../../src/common/constants";
import { MenuConfig, SystemTrayConfig } from "../../src/common/wowup/models";
import { createAppMenu } from "../app-menu";
import { createTray } from "../system-tray";
import { ipcHandle, IpcController } from "./ipc-controller";

/** The app menu and tray icon; the renderer supplies the translated labels */
export class MenuController implements IpcController {
  public constructor(private readonly _window: BrowserWindow) {}

  public register(): void {
    ipcHandle(IPC_CREATE_TRAY_MENU_CHANNEL, (_evt, config: SystemTrayConfig) => createTray(this._window, config));
    ipcHandle(IPC_CREATE_APP_MENU_CHANNEL, (_evt, config: MenuConfig) => createAppMenu(this._window, config));
  }
}
