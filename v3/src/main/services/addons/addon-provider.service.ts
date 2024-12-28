import { AddonProvider } from '../../models'
import { IService } from '../service'
import { injectable } from 'inversify'

export interface IAddonProviderService extends IService {}

@injectable()
export class AddonProviderService implements IAddonProviderService {
  private _addonProviders: AddonProvider[] = []

  public constructor() {
    console.log('init AddonProviderService', this._addonProviders)
  }
}
