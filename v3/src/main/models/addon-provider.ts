import { WarcraftClient } from '@shared/warcraft'
import { AddonFolder } from './addon-folder'
import { AddonChannelType, AddonProviderSettings } from '@shared/addons'

export interface AddonProvider {
  getSettings(): AddonProviderSettings
  isEnabled(): boolean
  getName(): string

  scan(
    installation: WarcraftClient,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void>

  // getAllBatch(installations: WowInstallation[], addonIds: string[]): Promise<GetAllBatchResult>
  // getAll(installation: WowInstallation, addonIds: string[]): Promise<GetAllResult>
  // getFeaturedAddons(
  //   installation: WowInstallation,
  //   channelType?: AddonChannelType
  // ): Promise<AddonSearchResult[]>
  // shouldMigrate(addon: Addon): boolean
  // searchByQuery(
  //   query: string,
  //   installation: WowInstallation,
  //   channelType?: AddonChannelType
  // ): Promise<AddonSearchResult[]>
  // searchByUrl(addonUri: URL, installation: WowInstallation): Promise<SearchByUrlResult | undefined>
  // searchProtocol(protocol: string): Promise<ProtocolSearchResult | undefined>
  // getCategory(category: AddonCategory, installation: WowInstallation): Promise<AddonSearchResult[]>
  // getById(addonId: string, installation: WowInstallation): Promise<AddonSearchResult | undefined>
  // isValidAddonUri(addonUri: URL): boolean
  // isValidAddonId(addonId: string): boolean
  // isValidProtocol(protocol: string): boolean

  // getChangelog(
  //   installation: WowInstallation,
  //   externalId: string,
  //   externalReleaseId: string
  // ): Promise<string>
  // getDescription(installation: WowInstallation, externalId: string, addon?: Addon): Promise<string>
  // getAdPageParams(): AdPageOptions | undefined
  // getDownloadAuth(): Promise<DownloadAuth | undefined>
}
