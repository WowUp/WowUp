import { AddonProviderType } from './addon-provider-type'

export abstract class AddonProvider {
  name: AddonProviderType = 'Unknown'
  enabled: boolean = true
  forceIgnore: boolean = false
  allowReinstall: boolean = false
  allowChannelChange: boolean = false
  allowEdit: boolean = false
  allowViewAtSource: boolean = false
  allowReScan: boolean = false
  canShowChangelog: boolean = false
  canBatchFetch: boolean = false
  authRequired: boolean = false
  adRequired: boolean = false
  providerNote: string = ''
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
  // scan(
  //   installation: WowInstallation,
  //   addonChannelType: AddonChannelType,
  //   addonFolders: AddonFolder[]
  // ): Promise<void>
  // getChangelog(
  //   installation: WowInstallation,
  //   externalId: string,
  //   externalReleaseId: string
  // ): Promise<string>
  // getDescription(installation: WowInstallation, externalId: string, addon?: Addon): Promise<string>
  // getAdPageParams(): AdPageOptions | undefined
  // getDownloadAuth(): Promise<DownloadAuth | undefined>
}
