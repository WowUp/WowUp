import { inject, injectable } from 'inversify'
import { IPCHandler } from './ipc-handler'
import { ipcMain } from 'electron/main'
import { AddonMessage } from '../../../shared/messages'
import { join } from 'path'
import {
  AddonScanService,
  AddonSyncService,
  type IAddonSyncService,
  type IAddonScanService
} from '../../services'

export interface IAddonHandler extends IPCHandler {}

@injectable()
export class AddonHandler implements IAddonHandler {
  public constructor(
    @inject(AddonScanService) private _addonScanService: IAddonScanService,
    @inject(AddonSyncService) private _addonSyncService: IAddonSyncService
  ) {}

  public init(): void {
    console.log('init AddonHandler')

    ipcMain.handle(AddonMessage.ScanAddonFolder, this.onScanAddonFolder)
  }

  private onScanAddonFolder = async (_evt, wowClientId: string): Promise<string> => {
    const addonFolders = await this._addonScanService.scanWowClient(wowClientId)
    console.debug('addonFolders', addonFolders)

    await this._addonSyncService.syncClient(wowClientId, addonFolders)

    return join(__dirname, '..', 'preload', 'index.js')
  }
}
