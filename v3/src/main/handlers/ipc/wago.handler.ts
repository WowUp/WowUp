import { inject, injectable } from 'inversify'
import { IPCHandler } from './ipc-handler'
import { ipcMain } from 'electron/main'
import { WagoMessage } from '../../../shared/messages'
import { join } from 'path'
import { type IWagoService, WagoService } from '../../services'

export interface IWagoHandler extends IPCHandler {}

@injectable()
export class WagoHandler implements IWagoHandler {
  public constructor(@inject(WagoService) private _wagoService: IWagoService) {}

  public init(): void {
    console.log('init WagoHandler')

    ipcMain.handle(WagoMessage.GetPreloadPath, this.onGetPreloadPath)

    ipcMain.on(WagoMessage.TokenReceived, this.onTokenReceived)
  }

  private onGetPreloadPath = (): string => {
    return join(__dirname, '..', 'preload', 'index.js')
  }

  private onTokenReceived = (_, token: string): void => {
    console.log('onTokenReceived', token)
    this._wagoService.setToken(token)
  }
}
