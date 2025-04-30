import { v4 as uuidv4 } from 'uuid'
import * as cfv2 from 'curseforge-v2'
import { inject, injectable } from 'inversify'
import { AddonFolder, AddonProvider } from '../../models'
import { Addon, AddonChannelType, AddonProviderSettings } from '@shared/addons'
import { ADDON_PROVIDER_CURSEFORGE, TYPES } from '../../constants'
import { type ITocService, type INetworkService } from '../../services'
import { WarcraftClient, WowClientType } from '@shared/warcraft'
import { flatten } from 'lodash'
import { TocNotFoundError } from '../../errors'

interface ScanMatchPair {
  addonFolder: AddonFolder
  match: cfv2.CF2FingerprintMatch
  addon?: cfv2.CF2Addon
}

const GAME_TYPE_LISTS = [
  {
    flavor: 'wow_classic',
    typeId: 67408,
    matches: [WowClientType.ClassicEra, WowClientType.ClassicEraPtr]
  },
  {
    flavor: 'wow-wrath-classic',
    typeId: 73713,
    matches: []
  },
  {
    flavor: 'wow_retail',
    typeId: 517,
    matches: [
      WowClientType.Retail,
      WowClientType.RetailPtr,
      WowClientType.Beta,
      WowClientType.RetailXPtr
    ]
  },
  {
    flavor: 'wow-cataclysm-classic',
    typeId: 77522,
    matches: [WowClientType.Classic, WowClientType.ClassicPtr, WowClientType.ClassicBeta]
  }
]

@injectable()
export class CurseforgeProvider implements AddonProvider {
  private readonly _cf2Client: cfv2.CFV2Client

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
    name: ADDON_PROVIDER_CURSEFORGE,
    providerNote: ''
  }

  public constructor(
    @inject(TYPES.INetworkService) private _networkService: INetworkService,
    @inject(TYPES.ITocService) private _tocService: ITocService
  ) {
    const cfKey = import.meta.env.VITE_CURSEFORGE_API_KEY
    this._cf2Client = new cfv2.CFV2Client({
      apiKey: cfKey
    })
  }

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
    if (!addonFolders.length) {
      return
    }

    const folders = addonFolders.filter(
      (folder) => folder.scanResults.get(this.getName())?.length ?? 0 > 0
    )

    const scanResults = flatten(
      folders.map((folder) => folder.scanResults.get(this.getName()) ?? [])
    )

    const fingerprints = scanResults.map((sr) => sr.fingerprintNum)

    const result = await this._cf2Client.getFingerprintMatches({ fingerprints })
    if (result.statusCode !== 200) {
      throw new Error(`Failed to get fingerprint matches: ${result.statusCode}`)
    }

    const fingerprintData = result.data?.data
    try {
      const matchPairs: ScanMatchPair[] = []
      for (const af of addonFolders) {
        const folderScanResults = af.scanResults.get(this.getName()) ?? []

        let exactMatch = fingerprintData?.exactMatches.find(
          (em) =>
            this.isCfFileCompatible(installation.wowClientType, em.file) &&
            em.file.modules.some((m) =>
              folderScanResults?.some((x) => x.fingerprintNum === m.fingerprint)
            )
        )

        // If the addon does not have an exact match, check the partial matches.
        if (
          !exactMatch &&
          Array.isArray(fingerprintData?.partialMatches) &&
          fingerprintData !== undefined
        ) {
          exactMatch = fingerprintData.partialMatches.find((partialMatch) =>
            partialMatch.file?.modules?.some((module) =>
              folderScanResults.some((x) => x.fingerprintNum === module.fingerprint)
            )
          )
        }

        if (exactMatch) {
          matchPairs.push({
            addonFolder: af,
            match: exactMatch
          })
        }
      }

      const addonIds = matchPairs.map((mp) => mp.match.id)
      const getAddonsResult = await this._cf2Client.getMods({ modIds: addonIds })
      const addonResultData = getAddonsResult.data?.data

      const potentialChildren: ScanMatchPair[] = []
      matchPairs.forEach((mp) => {
        const cfAddon = addonResultData?.find((ar) => ar.id === mp.match.id)
        if (!cfAddon) {
          return
        }

        try {
          mp.addonFolder.matchingAddon = this.createAddon(
            installation,
            mp.addonFolder,
            mp.match.file,
            cfAddon
          )
        } catch (e) {
          if (e instanceof TocNotFoundError) {
            potentialChildren.push(mp)
          } else {
            console.error(e)
          }
        }
      })

      potentialChildren.forEach((pc) => {
        const parent = matchPairs.find(
          (mp) =>
            mp.addonFolder.matchingAddon !== undefined &&
            this.isChildAddon(mp.match.file, pc.addonFolder.name)
        )
        pc.addonFolder.matchingAddon = parent?.addonFolder.matchingAddon
      })
    } catch (e) {
      console.error('failed to process fingerprint response')
      console.error(e)
      console.log(result)
      throw e
    }
  }

  private isCfFileCompatible(clientType: WowClientType, file: cfv2.CF2File): boolean {
    if (Array.isArray(file.sortableGameVersions) && file.sortableGameVersions.length > 0) {
      const gameVersionTypeId = this.getGameVersionTypeId(clientType)
      return this.hasSortableGameVersion(file, gameVersionTypeId)
    }

    return false
  }

  private isChildAddon(cfAddon: cfv2.CF2File, addonName: string): boolean {
    return cfAddon.modules.some((m) => m.name == addonName)
  }

  private hasSortableGameVersion(file: cfv2.CF2File, typeId: number): boolean {
    if (!file?.sortableGameVersions) {
      console.debug('sortableGameVersions missing', file)
    }
    return file.sortableGameVersions.some((sgv) => sgv.gameVersionTypeId === typeId)
  }

  private getGameVersionTypeId(clientType: WowClientType): number {
    const gameType = GAME_TYPE_LISTS.find((gtl) => gtl.matches.includes(clientType))
    if (!gameType) {
      throw new Error(`Game type not found: ${clientType}`)
    }

    return gameType.typeId
  }

  private createAddon(
    installation: WarcraftClient,
    addonFolder: AddonFolder,
    cfFile: cfv2.CF2File,
    cfAddon: cfv2.CF2Addon
  ): Addon {
    // const authors = cfAddon.authors.map((author) => author.name).join(', ')
    // const folders = cfFile.modules.map((module) => module.name)
    // const folderList = folders.join(',')
    // const latestFiles = this.getLatestFiles(cfAddon, installation.clientType)

    // const channelType = this.getChannelType(cfFile.releaseType)
    // const latestVersion = latestFiles.find(
    //   (lf) => this.getChannelType(lf.releaseType) <= channelType
    // )

    const targetToc = this._tocService.getTocForGameType2(
      addonFolder.name,
      addonFolder.tocs,
      installation.wowClientType
    )
    if (!targetToc) {
      console.error('targetToc undefined', cfAddon.name, addonFolder.tocs)
      throw new TocNotFoundError('Target toc not found')
    }

    // const gameVersions = getGameVersionList(targetToc.interface)

    const addon: Addon = {
      id: uuidv4(),
      //   author: authors,
      name: cfAddon?.name ?? 'unknown',
      //   channelType,
      //   autoUpdateEnabled: false,
      //   autoUpdateNotificationsEnabled: false,
      //   clientType: installation.clientType,
      //   downloadUrl: latestVersion?.downloadUrl ?? cfFile.downloadUrl ?? '',
      //   externalUrl: cfAddon?.links?.websiteUrl ?? '',
      externalId: cfAddon?.id.toString() ?? '',
      externalIds: [],
      //   gameVersion: gameVersions,
      //   installedAt: new Date(addonFolder?.fileStats?.birthtimeMs ?? 0),
      //   installedFolders: folderList,
      //   installedFolderList: folders,
      //   installedVersion: cfFile.displayName,
      //   installedExternalReleaseId: cfFile.id.toString(),
      //   isIgnored: false,
      //   latestVersion: latestVersion?.displayName ?? cfFile.displayName ?? '',
      providerName: this.getName()
      //   thumbnailUrl: cfAddon ? this.getThumbnailUrl(cfAddon) : '',
      //   screenshotUrls: cfAddon ? this.getScreenshotUrls(cfAddon) : [],
      //   downloadCount: cfAddon?.downloadCount ?? 0,
      //   summary: cfAddon?.summary ?? '',
      //   releasedAt: new Date(latestVersion?.fileDate ?? cfFile.fileDate ?? ''),
      //   isLoadOnDemand: false,
      //   externalLatestReleaseId: (latestVersion?.id ?? cfFile.id ?? '').toString(),
      //   updatedAt: addonFolder?.fileStats?.birthtime ?? new Date(0),
      //   externalChannel: getEnumName(AddonChannelType, channelType),
      //   installationId: installation.id
    }

    // if (!latestFiles.length) {
    //   addon.warningType = AddonWarningType.NoProviderFiles
    // }

    return addon
  }
}
