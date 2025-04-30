import { inject, injectable } from 'inversify'
import { IService } from '../service'
import { AddonFolder } from '../../models'
import { AddonProviderService, type IAddonProviderService } from './addon-provider.service'
import { DatabaseService, type IDatabaseService } from '../database.service'
import { Addon, AddonChannelType } from '@shared/addons'
import { type ITocService } from './toc.service'
import { TYPES } from '../../constants'
import { WarcraftClient } from '@shared/warcraft'
import { Toc } from '@shared/addons/toc'
import { difference, groupBy, orderBy } from 'lodash'
import { type IRendererMessageService } from '../renderer-message.service'
import { AddonMessage } from '@shared/messages'

export interface IAddonSyncService extends IService {
  syncClient(wowClientId: string, addonFolders: AddonFolder[]): Promise<Addon[]>
}

@injectable()
export class AddonSyncService implements IAddonSyncService {
  public constructor(
    @inject(DatabaseService) private _databaseService: IDatabaseService,
    @inject(TYPES.ITocService) private _tocService: ITocService,
    @inject(AddonProviderService) private _addonProviderService: IAddonProviderService,
    @inject(TYPES.IRendererMessageService) private _rendererMessageService: IRendererMessageService
  ) {
    console.log('init AddonSyncService')
  }

  public async syncClient(wowClientId: string, addonFolders: AddonFolder[]): Promise<Addon[]> {
    const wowClient = await this._databaseService.getClient(wowClientId)
    if (wowClient === null) {
      console.error(`[syncClient] wowClient not found: ${wowClientId}`)
      return []
    }

    const providers = this._addonProviderService.getEnabledProviders()
    for (const provider of providers) {
      try {
        const validFolders = addonFolders.filter((af) => !af.matchingAddon && af.tocs.length > 0)
        this._rendererMessageService.sendMessage(
          AddonMessage.ScanningAddonProvider,
          provider.getName()
        )
        await provider.scan(wowClient, AddonChannelType.Stable, validFolders)
      } catch (err) {
        console.error('failed to scan provider', provider.getName(), err)
      }
    }

    this.mapScanResultTocFiles(wowClient, addonFolders)

    const matchedAddons = this.getMatchedAddons(addonFolders)

    const unmatchedFolders = addonFolders.filter((af) =>
      this.isAddonFolderUnmatched(addonFolders, af, wowClient)
    )

    // for (const uf of unmatchedFolders) {
    //   const unmatchedAddon = await this.createUnmatchedAddon(uf, installation, matchedAddonFolderNames);
    //   addonList.push(unmatchedAddon);
    // }

    console.debug('syncClient', wowClientId, addonFolders, this._addonProviderService)
    console.debug('matchedAddons', matchedAddons)
    console.debug('unmatchedFolders', unmatchedFolders)

    await this._databaseService.setAddons({ wowClientId, addons: matchedAddons })

    return matchedAddons
  }

  private mapScanResultTocFiles(client: WarcraftClient, addonFolders: AddonFolder[]): void {
    for (const addonFolder of addonFolders) {
      if (addonFolder.matchingAddon === undefined) {
        continue
      }

      const targetToc = this._tocService.getTocForGameType2(
        addonFolder.name,
        addonFolder.tocs,
        client.wowClientType
      )
      if (targetToc === undefined) {
        console.warn('toc file undefined', addonFolder, client.wowClientType)
        continue
      }
      if (!targetToc.fileName.startsWith(addonFolder.name)) {
        console.warn('TOC NAME MISMATCH', addonFolder.name, targetToc.fileName)
        // addonFolder.matchingAddon.warningType = AddonWarningType.TocNameMismatch
      }

      this.setExternalIds(addonFolder.matchingAddon, targetToc)
    }
  }

  private getMatchedAddons(addonFolders: AddonFolder[]): Addon[] {
    const addonList: Addon[] = []

    const matchedAddonFolders = addonFolders.filter((addonFolder) => !!addonFolder.matchingAddon)

    const matchedGroups = groupBy(
      matchedAddonFolders,
      (addonFolder) =>
        `${addonFolder.matchingAddon?.providerName ?? ''}${addonFolder.matchingAddon?.externalId ?? ''}`
    )

    for (const value of Object.values(matchedGroups)) {
      const ordered = orderBy(value, (v) => v.matchingAddon?.externalIds?.length ?? 0).reverse()
      const first = ordered[0]
      if (first.matchingAddon) {
        addonList.push(first.matchingAddon)
      }
    }

    // addonList.forEach(addon => {
    //   if (!addon) {
    //     return;
    //   }

    //   addon.latestChangelog = undefined;
    //   addon.latestChangelogVersion = undefined;
    //   addon.channelType = installation.defaultAddonChannelType;
    // })

    return addonList.filter((addon) => !!addon)
  }

  private setExternalIds(addon: Addon, toc: Toc): void {
    if (!toc) {
      return
    }

    // const externalIds: AddonExternalId[] = []
    // for (const [key, value] of Object.entries(ADDON_PROVIDER_TOC_EXTERNAL_ID_MAP)) {
    //   this.insertExternalId(externalIds, key, toc[value] as string)
    // }

    // //If the addon does not include the current external id add it
    // if (!this.containsOwnExternalId(addon, externalIds)) {
    //   if (!addon.providerName || !addon.externalId) {
    //     return
    //   }

    //   this.insertExternalId(externalIds, addon.providerName, addon.externalId)
    // }

    // addon.externalIds = externalIds
  }

  /**
   * This should verify that a folder that did not have a match, is actually unmatched
   * This will happen for any sub folders of TukUI or WowInterface addons
   */
  private isAddonFolderUnmatched(
    addonFolders: AddonFolder[],
    addonFolder: AddonFolder,
    installation: WarcraftClient
  ): boolean {
    if (addonFolder.matchingAddon) {
      return false
    }

    const targetToc = this._tocService.getTocForGameType2(
      addonFolder.name,
      addonFolder.tocs,
      installation.wowClientType
    )

    const matchedAddonFolders = addonFolders.filter((addonFolder) => !!addonFolder.matchingAddon)
    const matchedAddonFolderNames = matchedAddonFolders.map((mf) => mf.name)

    // if the folder is load on demand, it 'should' be a sub folder
    const isLoadOnDemand = targetToc?.loadOnDemand === '1'
    if (isLoadOnDemand && this.allItemsMatch(targetToc.dependencyList, matchedAddonFolderNames)) {
      return false
    }

    return true
  }

  /** Check if all primitives in subset are in the superset (strings, ints) */
  private allItemsMatch<T>(subset: T[], superset: T[]): boolean {
    return difference(subset, superset).length === 0
  }
}
