import { ipcMain, IpcMainInvokeEvent } from "electron";

export interface IpcController {
  register(): void;

  /**
   * Called once when the window these controllers were registered for goes away. Implement it if
   * the controller owns anything that outlives an ipc call, e.g. a timer or a native view.
   */
  dispose?(): void;
}

/**
 * The main window can be recreated (e.g. macos activate with no window), which registers
 * controllers a second time, so replace any handler from a previous window instead of throwing.
 */
export function ipcHandle(channel: string, listener: (evt: IpcMainInvokeEvent, ...args: any[]) => unknown): void {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, listener);
}
