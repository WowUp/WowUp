import { v4 as uuidv4 } from 'uuid'
import { inject, injectable } from 'inversify'
import { AddonFolder, AddonProvider } from '../../models'
import { Addon, AddonChannelType, AddonProviderSettings } from '@shared/addons'
import { ADDON_PROVIDER_TUKUI, TYPES } from '../../constants'
import { type ITocService, type INetworkService } from '../../services'
import { WarcraftClient, WowClientType } from '@shared/warcraft'
import { filter, find, first, orderBy, sortBy } from 'lodash'
import { Toc } from '@shared/addons/toc'
import * as stringSimilarity from 'string-similarity'

export interface TukUiAddon {
  id: string
  slug: string
  author: string
  name: string
  url: string
  version: string
  changelog_url: string
  ticket_url: string
  git_url: string
  patch: string[]
  last_update: string
  web_url: string
  donate_url: string
  small_desc: string
  screenshot_url: string
  directories: string[]
}

@injectable()
export class TukUiProvider implements AddonProvider {
  private readonly _baseUrl = import.meta.env.VITE_TUKUI_URL

  private _settings: AddonProviderSettings = {
    adRequired: false,
    allowChannelChange: true,
    allowEdit: true,
    allowReinstall: true,
    allowReScan: false,
    allowViewAtSource: false,
    authRequired: false,
    canBatchFetch: true,
    canShowChangelog: false,
    enabled: true,
    forceIgnore: false,
    name: ADDON_PROVIDER_TUKUI,
    providerNote: ''
  }

  public constructor(
    @inject(TYPES.INetworkService) private _networkService: INetworkService,
    @inject(TYPES.ITocService) private _tocService: ITocService
  ) {}

  public getSettings(): AddonProviderSettings {
    return { ...this._settings }
  }

  public isEnabled(): boolean {
    return this._settings.enabled
  }

  public getName(): string {
    return this._settings.name
  }

  public async scan(
    installation: WarcraftClient,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {
    const allAddons = await this.getAllAddons(installation.wowClientType)

    // Sort folders to prioritize ones with a toc id
    let tukProjectAddonFolders = sortBy(addonFolders, (folder) =>
      folder.tocs.some((toc) => !!toc.tukUiProjectId && toc.loadOnDemand !== '1')
    ).reverse()

    // Remove all folders that do not have a matching game type
    tukProjectAddonFolders = filter(
      tukProjectAddonFolders,
      (af) =>
        this._tocService.getTocForAddonFolderGameType(af, installation.wowClientType) !== undefined
    )

    // Go thru all the folders, see if they have an ID we can match.
    await this.scanAddonsWithIds(tukProjectAddonFolders, allAddons, installation)

    // Go thru all the folders and see if any of the non-matched belong to the folder list of any matched ones
    await this.matchAddonSubfolders(tukProjectAddonFolders, installation)

    // Go thru all the folders and see if the names match anything that did not have a match
    await this.scanAddonsWithNames(tukProjectAddonFolders, installation)

    // repeat step 2 for remaining non-matched folders
    await this.matchAddonSubfolders(tukProjectAddonFolders, installation)
  }

  private async scanAddonsWithNames(
    addonFolders: AddonFolder[],
    installation: WarcraftClient
    // addonChannelType: AddonChannelType
  ): Promise<void> {
    const missingAddons = filter(addonFolders, (af) => af.matchingAddon === undefined)

    for (const addonFolder of missingAddons) {
      const targetToc = this._tocService.getTocForAddonFolderGameType(
        addonFolder,
        installation.wowClientType
      )
      if (targetToc === undefined) {
        console.warn(`[TukUI]: target toc was undefined`, installation.wowClientType, addonFolder)
        continue
      }

      //   console.info(`[TukUI]: falling back to title search`, targetToc.title)
      const results = await this.searchAddons(targetToc.title, installation.wowClientType)
      const firstResult = first(results)
      if (firstResult === undefined) {
        continue
      }

      addonFolder.matchingAddon = await this.createAddonFolderAddon(
        targetToc,
        addonFolder,
        firstResult
        // installation,
        // addonChannelType
      )
    }
  }

  private async searchAddons(
    addonName: string | undefined,
    clientType: WowClientType,
    allowContain = false
  ): Promise<TukUiAddon[]> {
    if (!addonName) {
      return []
    }

    const canonAddonName = addonName.toLowerCase()
    const addons = await this.getAllAddons(clientType)

    const similarity = addons
      .map((addon) => {
        const compSim = stringSimilarity.compareTwoStrings(canonAddonName, addon.name.toLowerCase())
        return { addon, similarity: compSim }
      })
      .filter((result) => result.similarity > 0.7)

    let matches = orderBy(similarity, (match) => match.similarity, 'desc').map(
      (result) => result.addon
    )

    // If we didnt get any similarity matches
    if (allowContain && matches.length === 0) {
      matches = addons.filter((addon) => addon.name.toLowerCase().indexOf(canonAddonName) !== -1)
    }

    return matches
  }

  /** Iterate the list of addon folders, attempting to find and match anything based on the ID inside the correct toc file */
  private async scanAddonsWithIds(
    addonFolders: AddonFolder[],
    allAddons: TukUiAddon[],
    installation: WarcraftClient
    // addonChannelType: AddonChannelType
  ): Promise<void> {
    for (const addonFolder of addonFolders) {
      const targetToc = this._tocService.getTocForAddonFolderGameType(
        addonFolder,
        installation.wowClientType
      )
      if (targetToc === undefined) {
        console.warn(`[TukUI]: target toc was undefined`, installation.wowClientType, addonFolder)
        continue
      }

      //   console.log(
      //     `[TukUI]: target ${targetToc.fileName}, ${targetToc.title}, ${targetToc.tukUiProjectId}`
      //   )

      if (typeof targetToc.tukUiProjectId === 'string' && targetToc.tukUiProjectId.length > 0) {
        const match = find(allAddons, (addon) => addon.id.toString() === targetToc.tukUiProjectId)
        if (match === undefined) {
          continue
        }

        addonFolder.matchingAddon = await this.createAddonFolderAddon(
          targetToc,
          addonFolder,
          match
          //   installation,
          //   addonChannelType
        )
      }
    }
  }

  private getAllAddons = async (clientType: WowClientType): Promise<TukUiAddon[]> => {
    if (clientType === WowClientType.None) {
      return []
    }

    try {
      return this.fetchApiResults()
    } catch (err) {
      console.error(err)
      return []
    }
  }

  private fetchApiResults = async (): Promise<TukUiAddon[]> => {
    const url = new URL(this._baseUrl)
    const addons = await this._networkService.getJson<TukUiAddon[]>(url)
    return addons
  }

  /** Given a list of pre-processed addon folders, attempt to place any matching folders with their 'parent' addon that has a list containing it */
  private async matchAddonSubfolders(
    addonFolders: AddonFolder[],
    installation: WarcraftClient
  ): Promise<void> {
    // const matchedAddons = filter(addonFolders, (af) => af.matchingAddon !== undefined)
    const missingAddons = filter(addonFolders, (af) => af.matchingAddon === undefined)

    for (const addonFolder of missingAddons) {
      const targetToc = this._tocService.getTocForAddonFolderGameType(
        addonFolder,
        installation.wowClientType
      )
      if (targetToc === undefined) {
        console.warn(`[TukUI]: target toc was undefined`, installation.wowClientType, addonFolder)
        continue
      }

      //   const parent = matchedAddons.find((ma) =>
      //     ma.matchingAddon?.installedFolderList?.includes(addonFolder.name)
      //   )
      //   if (parent?.matchingAddon === undefined) {
      //     continue
      //   }

      //   console.info(
      //     `[TukUI]: parent found ${parent.name} : ${targetToc.fileName}, ${targetToc.title}, ${targetToc.tukUiProjectId}`
      //   )

      // this match is just a copy of the parent since its a sub-addon
      //   addonFolder.matchingAddon = { ...parent.matchingAddon }
    }
  }

  /** Create an addon from the matched TukUi addon and correct toc file */
  private async createAddonFolderAddon(
    targetToc: Toc,
    addonFolder: AddonFolder,
    tukUiAddon: TukUiAddon
    // installation: WarcraftClient,
    // addonChannelType: AddonChannelType
  ): Promise<Addon> {
    // const installedFolders = targetToc.tukUiProjectFolders
    //   ? targetToc.tukUiProjectFolders
    //   : addonFolder.name

    // const installedFolderList = targetToc.tukUiProjectFolders
    //   ? targetToc.tukUiProjectFolders.split(',').map((f) => f.trim())
    //   : [addonFolder.name]

    return {
      //   autoUpdateEnabled: false,
      //   autoUpdateNotificationsEnabled: false,
      //   channelType: addonChannelType,
      //   clientType: installation.clientType,
      id: uuidv4(),
      //   isIgnored: false,
      name: tukUiAddon.name,
      //   author: tukUiAddon.author,
      //   downloadUrl: tukUiAddon.url,
      externalId: tukUiAddon.id.toString(),
      externalIds: [],
      //   externalUrl: tukUiAddon.web_url,
      //   gameVersion: targetToc.interface,
      //   installedAt: addonFolder.fileStats?.birthtime ?? new Date(0),
      //   installedFolders,
      //   installedFolderList,
      //   installedVersion: targetToc.version,
      //   latestVersion: tukUiAddon.version,
      providerName: this.getName()
      //   thumbnailUrl: tukUiAddon.screenshot_url,
      //   updatedAt: new Date(),
      //   summary: tukUiAddon.small_desc,
      //   downloadCount: DOWNLOAD_CT,
      //   screenshotUrls: [tukUiAddon.screenshot_url],
      //   releasedAt: new Date(`${tukUiAddon.last_update} UTC`),
      //   isLoadOnDemand: false,
      //   latestChangelog: undefined, //await this.formatChangelog(tukUiAddon),
      //   externalChannel: getEnumName(AddonChannelType, AddonChannelType.Stable),
      //   installationId: installation.id
    }
  }
}
