import { inject, injectable } from 'inversify'
import { IService } from '../service'
import { AddonFolder } from '../../models'
import { AddonProviderService, type IAddonProviderService } from './addon-provider.service'
import { DatabaseService, type IDatabaseService } from '../database.service'

export interface IAddonSyncService extends IService {
  syncClient(wowClientId: string, addonFolders: AddonFolder[]): Promise<void>
}

@injectable()
export class AddonSyncService implements IAddonSyncService {
  public constructor(
    @inject(DatabaseService) private _databaseService: IDatabaseService,
    @inject(AddonProviderService) private _addonProviderService: IAddonProviderService
  ) {
    console.log('init AddonSyncService')
  }

  public async syncClient(wowClientId: string, addonFolders: AddonFolder[]): Promise<void> {
    const wowClient = await this._databaseService.getClient(wowClientId)
    if (wowClient === null) {
      console.error(`[syncClient] wowClient not found: ${wowClientId}`)
      return
    }

    console.debug('syncClient', wowClientId, addonFolders, this._addonProviderService)
  }
}
