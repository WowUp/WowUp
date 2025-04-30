import { inject, injectable } from 'inversify'
import { IPCHandler } from './ipc-handler'
import { ipcMain } from 'electron/main'
import { AddonMessage } from '../../../shared/messages'
import {
  AddonScanService,
  AddonSyncService,
  type IAddonSyncService,
  type IAddonScanService,
  type IAddonStoreService
} from '../../services'
import { Addon } from '@shared/addons'
import { TYPES } from '../../constants'

export interface IAddonHandler extends IPCHandler {}

@injectable()
export class AddonHandler implements IAddonHandler {
  public constructor(
    @inject(TYPES.IAddonStoreService) private _addonStoreService: IAddonStoreService,
    @inject(AddonScanService) private _addonScanService: IAddonScanService,
    @inject(AddonSyncService) private _addonSyncService: IAddonSyncService
  ) {}

  public init(): void {
    console.log('init AddonHandler')

    ipcMain.handle(AddonMessage.ScanAddonFolder, this.onScanAddonFolder)

    ipcMain.handle(AddonMessage.GetAddonList, this.onGetAddonList)
  }

  private onScanAddonFolder = async (_evt, wowClientId: string): Promise<Addon[]> => {
    const addonFolders = await this._addonScanService.scanWowClient(wowClientId)
    console.debug('addonFolders', addonFolders)
    return await this._addonSyncService.syncClient(wowClientId, addonFolders)
  }

  private onGetAddonList = async (_evt, wowClientId: string): Promise<Addon[]> => {
    return await this._addonStoreService.getAddons(wowClientId)
  }
}
