import { inject, injectable } from 'inversify'
import { IService } from '../service'
import { Addon } from '@shared/addons'
import { DatabaseService, type IDatabaseService } from '../database.service'

export interface IAddonStoreService extends IService {
  getAddons(wowClientId: string): Promise<Addon[]>
}

@injectable()
export class AddonStoreService implements IAddonStoreService {
  public constructor(@inject(DatabaseService) private _databaseService: IDatabaseService) {}

  public async getAddons(wowClientId: string): Promise<Addon[]> {
    const addonCollection = await this._databaseService.getAddons(wowClientId)
    return addonCollection ? addonCollection.addons : []
  }
}
