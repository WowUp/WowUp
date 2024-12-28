import { IpcMain } from 'electron/main'

export interface IPCHandler {
  init: (ipcMain: IpcMain) => void
}
