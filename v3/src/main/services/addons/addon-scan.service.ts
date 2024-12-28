import log from 'electron-log/main'
import { inject, injectable, optional } from 'inversify'
import { IService } from '../service'
import {
  CurseFolderScanner,
  type IWowUpFolderScanner,
  WowUpFolderScanner,
  type ICurseFolderScanner
} from '../../providers'
import { DatabaseService, type IDatabaseService } from '../database.service'
import { WarcraftClient } from '../../../shared/warcraft'
import * as fu from '../../utilities/files'
import { basename, extname, join } from 'path'
import { readdir } from 'fs/promises'
import * as _ from 'lodash'
import { Toc } from '@shared/addons/toc'
import { type ITocService, TocService } from './toc.service'
import { limitedForEach } from '../../utilities/operations'
import { AddonFolder } from '../../models'

export interface IAddonScanService extends IService {
  scanWowClient(wowClientId: string): Promise<AddonFolder[]>
}

@injectable()
export class AddonScanService implements IAddonScanService {
  public constructor(
    @inject(DatabaseService) private _databaseService: IDatabaseService,
    @inject(TocService) private _tocService: ITocService,
    @inject(CurseFolderScanner) @optional() private _curseFolderScanner: ICurseFolderScanner,
    @inject(WowUpFolderScanner) private _wowupFolderScanner: IWowUpFolderScanner
  ) {
    log.log('init AddonScanService')
  }

  public async scanWowClient(wowClientId: string): Promise<AddonFolder[]> {
    const wowClient = await this._databaseService.getClient(wowClientId)
    if (wowClient === null) {
      log.error(`[addon-scan] wowClient not found: ${wowClientId}`)
      return []
    }

    // const useSymlinkMode = await this._wowUpService.getUseSymlinkMode();
    const addonFolders = await this.getClientAddons(wowClient)
    if (addonFolders.length === 0) {
      return []
    }

    this.removeGitFolders(addonFolders)

    // if (Array.isArray(currentAddons)) {
    //   const skippedAddons = this.removeNonRescanFolders(addonFolders, currentAddons)
    //   addonList.push(...skippedAddons)
    // }

    await this.getAddonFolderFingerprints(addonFolders)

    return addonFolders
  }

  private async getAddonFolderFingerprints(addonFolders: AddonFolder[]): Promise<void> {
    log.debug('[addon-scan] scanning folder:')

    let t = Date.now()
    await limitedForEach(
      addonFolders,
      async (addonFolder) => {
        const result = await this._wowupFolderScanner.scanFolder(addonFolder.path)
        addonFolder.scanResults.push(result)
      },
      3
    )
    log.debug(`[addon-scan] wowupFolderScanner.scanFolder took ${Date.now() - t}ms`)

    if (this._curseFolderScanner) {
      t = Date.now()
      await limitedForEach(
        addonFolders,
        async (addonFolder) => {
          const result = await this._curseFolderScanner.scanFolder(addonFolder.path)
          addonFolder.scanResults.push(result)
        },
        3
      )
      log.debug(`[addon-scan] curseFolderScanner.scanFolder took ${Date.now() - t}ms`)
    }
  }

  /**
   * Determine any addons who have providers with re-scanning disabled then remove any addon folders that match those addons
   * Ex: GitHub addons should remain as they cannot be re-scanned at this time via toc
   */
  // private removeNonRescanFolders(addonFolders: AddonFolder[], currentAddons: Addon[]): Addon[] {
  //   const remainingAddons: Addon[] = []
  //   const removedAddonFolders: AddonFolder[] = []

  //   for (const currentAddon of currentAddons) {
  //     const provider = this._addonProviderService.getProvider(currentAddon.providerName)
  //     if (provider === undefined || provider.allowReScan === true) {
  //       continue
  //     }

  //     const removed = _.remove(addonFolders, (af) =>
  //       currentAddon.installedFolderList.includes(af.name)
  //     )
  //     removedAddonFolders.push(...removed)

  //     remainingAddons.push(currentAddon)
  //   }

  //   log.log(
  //     `Removed ${removedAddonFolders.length} NonRescan folders: ${removedAddonFolders.map((af) => af.name).join(', ')}`
  //   )
  //   log.log(
  //     `Kept ${remainingAddons.length} NonRescan addons: ${remainingAddons.map((ad) => ad.name).join(', ')}`
  //   )

  //   return remainingAddons
  // }

  private async removeGitFolders(addonFolders: AddonFolder[]): Promise<void> {
    for (const addonFolder of addonFolders) {
      const directories = await fu.getDirectories(addonFolder.path, false)
      const hasGitFolder = directories.find((dir) => dir.toLowerCase() === '.git') !== undefined
      addonFolder.isGitRepo = hasGitFolder
    }
  }

  private async getClientAddons(wowClient: WarcraftClient): Promise<AddonFolder[]> {
    const addonFolders: AddonFolder[] = []

    // Folder may not exist if no addons have been installed
    const addonLocationExists = await fu.pathExists(wowClient.addonLocation)
    if (!addonLocationExists) {
      return addonFolders
    }

    const directories = await fu.getDirectories(wowClient.addonLocation, false)
    const dirPaths = directories.map((dir) => join(wowClient.addonLocation, dir))
    const dirStats = await fu.statFiles(dirPaths)

    for (let i = 0; i < dirPaths.length; i += 1) {
      const dir = dirPaths[i]
      const addonFolder = await this.getAddonFolder(dir)
      if (addonFolder === null) {
        log.warn(`Failed to get addonFolder, no toc found: ${dir}`)
        continue
      }
      addonFolder.fileStats = dirStats[dir]
      addonFolders.push(addonFolder)
    }

    return addonFolders
  }

  private async getAddonFolder(dir: string): Promise<AddonFolder | null> {
    try {
      const dirFiles = await readdir(dir)
      const tocFiles = _.filter(dirFiles, (f) => extname(f) === '.toc')
      if (tocFiles.length === 0) {
        return null
      }

      const tocs: Toc[] = []
      for (const tocFile of tocFiles) {
        const tocPath = join(dir, tocFile)
        const toc = await this._tocService.parse(tocPath)
        tocs.push(toc)
      }

      return {
        name: basename(dir),
        path: dir,
        tocs,
        scanResults: []
      }
    } catch (err) {
      log.error(err)
      return null
    }
  }
}
