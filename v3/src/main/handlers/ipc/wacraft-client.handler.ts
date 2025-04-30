import { inject, injectable } from 'inversify'
import { IPCHandler } from './ipc-handler'
import { IpcMain, IpcMainInvokeEvent } from 'electron/main'
import { type IWarcraftClientService, WarcraftClientService } from '../../services'
import { WarcraftClient, WowClientMessage } from '../../../shared/warcraft'

export interface IWarcraftClientHandler extends IPCHandler {}

@injectable()
export class WarcraftClientHandler implements IWarcraftClientHandler {
  private _warcraftClientService: IWarcraftClientService

  public constructor(@inject(WarcraftClientService) warcraftClientService: IWarcraftClientService) {
    this._warcraftClientService = warcraftClientService
  }

  public init(ipcMain: IpcMain): void {
    console.debug('init WarcraftClientHandler')

    ipcMain.handle(WowClientMessage.GetWowClients, this.handleGetWowClients)
    ipcMain.handle(WowClientMessage.GetSelectedWowClient, this.handleGetSelectedWowClient)
    ipcMain.on(WowClientMessage.SetSelectedWowClient, this.handleSetSelectedWowClient)
  }

  private handleGetSelectedWowClient = async (): Promise<string | null> => {
    return await this._warcraftClientService.getSelectedClientId()
  }

  private handleSetSelectedWowClient = async (
    _evt: IpcMainInvokeEvent,
    clientId: string
  ): Promise<void> => {
    try {
      await this._warcraftClientService.setSelectedClientId(clientId)
    } catch (err) {
      console.error('failed to set selected client id', err)
    }
  }

  private handleGetWowClients = async (): Promise<WarcraftClient[]> => {
    const clients = await this._warcraftClientService.getAllClients()
    return clients
  }
}
