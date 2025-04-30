import { injectable } from 'inversify'
import { IPCHandler } from './ipc-handler'
import { app, ipcMain } from 'electron'
import { OsMessage } from '@shared/messages'
import { showFile } from '../../utilities/files'

export interface IOsHandler extends IPCHandler {}

@injectable()
export class OsHandler implements IOsHandler {
  public init(): void {
    console.log('init OsHandler')

    ipcMain.handle(OsMessage.ShowFileInFolder, this.onShowFileInFolder)
    ipcMain.handle(OsMessage.ShowAppDataFolder, this.onShowAppFolder)
  }

  private onShowFileInFolder(_evt, filePath: string): void {
    showFile(filePath)
  }

  private onShowAppFolder(): void {
    try {
      const appDataPath = app.getPath('userData')
      showFile(appDataPath)
    } catch (err) {
      console.error(err)
    }
  }
}
