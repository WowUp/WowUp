import { IS_OW, TAGS, TYPES } from '../../constants'
import type { AddonProvider } from '../../models'
import { IService } from '../service'
import { inject, injectable, named } from 'inversify'

export interface IAddonProviderService extends IService {
  getEnabledProviders(): AddonProvider[]
}

@injectable()
export class AddonProviderService implements IAddonProviderService {
  private _addonProviders: AddonProvider[] = []

  public constructor(
    @inject(TYPES.IAddonProvider) @named(TAGS.WowUpProvider) _wowupProvider: AddonProvider,
    @inject(TYPES.IAddonProvider)
    @named(TAGS.CurseForgeProvider)
    _curseForgeProvider: AddonProvider,
    @inject(TYPES.IAddonProvider) @named(TAGS.TukUiProvider) _tukUiProvider: AddonProvider
  ) {
    this._addonProviders.push(_wowupProvider)

    if (IS_OW) {
      this._addonProviders.push(_curseForgeProvider)
    }

    this._addonProviders.push(_tukUiProvider)

    console.log('init AddonProviderService', this._addonProviders)
  }

  public getEnabledProviders(): AddonProvider[] {
    return this._addonProviders.filter((provider) => provider.isEnabled())
  }
}
