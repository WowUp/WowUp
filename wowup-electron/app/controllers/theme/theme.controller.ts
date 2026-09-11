import { BrowserWindow, ipcMain, nativeTheme } from "electron";

import { IPC_THEME_NATIVE_UPDATED, IPC_THEME_SHOULD_USE_DARK_COLORS } from "../../../src/common/constants";

import { IpcController } from "../ipc-controller";

export class ThemeController implements IpcController {
  public constructor(private readonly window: BrowserWindow) {}

  public register(): void {
    ipcMain.handle(IPC_THEME_SHOULD_USE_DARK_COLORS, () => nativeTheme.shouldUseDarkColors);

    nativeTheme.on("updated", () => {
      this.window?.webContents.send(IPC_THEME_NATIVE_UPDATED, nativeTheme.shouldUseDarkColors);
    });
  }
}
