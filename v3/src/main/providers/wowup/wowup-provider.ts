import { v4 as uuidv4 } from 'uuid'
import { getWowGameType, WarcraftClient, WowGameType } from '@shared/warcraft'
import { ADDON_PROVIDER_HUB, TYPES } from '../../constants'
import { AddonFolder, AddonProvider, AddonScanResult } from '../../models'
import { Addon, AddonChannelType, AddonProviderSettings } from '@shared/addons'
import { flatten, map } from 'lodash'
import { type INetworkService } from '../../services'
import { inject, injectable } from 'inversify'

export interface WowUpAddonFundingLinkRepresentation {
  platform: string
  url: string
}

export interface WowUpAddonRepresentation {
  id: number
  repository: string
  repository_name: string
  source: string
  owner_name?: string
  owner_image_url?: string
  image_url?: string
  description?: string
  homepage?: string
  total_download_count: number
  current_release?: WowUpAddonReleaseRepresentation
  matched_release?: WowUpAddonReleaseRepresentation
  releases?: WowUpAddonReleaseRepresentation[]
  funding_links?: WowUpAddonFundingLinkRepresentation[]
}

export interface AddonReleaseGameVersion {
  interface: string
  title: string
  game_type: WowGameType
  version: string
  authors: string
}

export interface WowUpAddonReleaseFolderRepresentation {
  id: number
  folder_name: string
  fingerprint: string
}

export interface AddonPreviewRepresentation {
  url: string
  preview_type: string
}

export interface WowUpAddonReleaseRepresentation {
  id: number
  url: string
  name: string
  tag_name: string
  external_id: string
  prerelease: boolean
  body: string
  game_versions: AddonReleaseGameVersion[]
  toc_title?: string
  download_url: string
  published_at: Date
  addonFolders?: WowUpAddonReleaseFolderRepresentation[]
  previews?: AddonPreviewRepresentation[]
}

export interface GetAddonsByFingerprintResponse {
  exactMatches: WowUpAddonRepresentation[]
}

@injectable()
export class WowUpProvider implements AddonProvider {
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
    name: ADDON_PROVIDER_HUB,
    providerNote: ''
  }

  private readonly _baseUrl = import.meta.env.VITE_WOWUP_HUB_URL

  public constructor(@inject(TYPES.INetworkService) private _networkService: INetworkService) {}

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
    const gameType = getWowGameType(installation.wowClientType)

    const folders = addonFolders.filter(
      (folder) => folder.scanResults.get(this.getName())?.length ?? 0 > 0
    )

    const scanResults = flatten(
      folders.map((folder) => folder.scanResults.get(this.getName()) ?? [])
    )
    const fingerprints = map(scanResults, (result) => result.fingerprint)

    const fingerprintResponse = await this.getAddonsByFingerprints(fingerprints)

    for (const scanResult of scanResults) {
      const addonFolder = addonFolders.find((af) => af.path === scanResult.path)
      if (addonFolder === undefined) {
        console.error('addon folder not found')
        continue
      }
      const fingerprintMatches = fingerprintResponse.exactMatches.filter((em) =>
        this.hasMatchingFingerprint(scanResult, em.matched_release)
      )

      let clientMatch = fingerprintMatches.find((exactMatch) =>
        this.hasGameType(exactMatch.matched_release, gameType)
      )

      if (!clientMatch && fingerprintMatches.length > 0) {
        console.warn(`No matching client type found for ${scanResult?.folderName}, using fallback`)
        clientMatch = fingerprintMatches[0]
      }
      if (clientMatch === undefined) {
        console.error('no matching client addon found')
        continue
      }

      addonFolder.matchingAddon = this.createAddon(installation, addonChannelType, clientMatch)
    }

    console.debug('scan', gameType, installation, addonChannelType, fingerprintResponse)
  }

  private async getAddonsByFingerprints(
    fingerprints: string[]
  ): Promise<GetAddonsByFingerprintResponse> {
    const url = `${this._baseUrl}/addons/fingerprint`
    return await this._networkService.post<GetAddonsByFingerprintResponse>(url, {
      fingerprints
    })
  }

  private createAddon(
    installation: WarcraftClient,
    addonChannelType: AddonChannelType,
    wowupAddon: WowUpAddonRepresentation
  ): Addon {
    if (wowupAddon.matched_release?.addonFolders === undefined) {
      throw new Error('No matched release')
    }

    const gameType = getWowGameType(installation.wowClientType)
    // const folders = wowupAddon.matched_release?.addonFolders?.map((af) => af.folder_name) ?? []
    // const folderList = folders.join(', ')

    let matchingVersion = this.getMatchingVersion(wowupAddon.matched_release, gameType)
    if (!matchingVersion) {
      matchingVersion = wowupAddon.matched_release.game_versions[0]
      console.warn(
        `No matching version found: ${wowupAddon.repository_name}, using fallback ${
          matchingVersion?.interface ?? ''
        }`
      )
    }

    const name = matchingVersion?.title || wowupAddon.repository_name
    const version = matchingVersion?.version || wowupAddon.matched_release?.tag_name || ''
    // const authors = matchingVersion?.authors || wowupAddon.owner_name || ''
    const interfaceVer = [matchingVersion?.interface]
    if (!name || !version || !interfaceVer) {
      throw new Error(
        `Invalid matching version data: name ${name}, version ${version}, interfaceVer ${interfaceVer}`
      )
    }

    const addon: Addon = {
      id: uuidv4(),
      name,
      externalId: wowupAddon?.id.toString() ?? 'unknown',
      externalIds: [],
      providerName: this.getName()
    }

    return addon
  }

  private hasMatchingFingerprint(
    scanResult: AddonScanResult,
    release: WowUpAddonReleaseRepresentation | undefined
  ): boolean {
    if (!release?.addonFolders) {
      return false
    }

    return release.addonFolders.some(
      (addonFolder) => addonFolder.fingerprint === scanResult?.fingerprint
    )
  }

  private hasGameType(
    release: WowUpAddonReleaseRepresentation | undefined,
    clientType: WowGameType
  ): boolean {
    if (!release) {
      return false
    }

    const matchingVersion = this.getMatchingVersion(release, clientType)
    return matchingVersion !== undefined
  }

  // Only 1 game version should match a given game type
  private getMatchingVersion(
    release: WowUpAddonReleaseRepresentation,
    gameType: WowGameType
  ): AddonReleaseGameVersion | undefined {
    return release.game_versions.find((gv) => gv.game_type === gameType)
  }
}
