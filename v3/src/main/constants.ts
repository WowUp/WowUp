export const APP_USER_MODEL_ID = 'io.wowup.jliddev' // Bundle ID
export const APP_USER_MODEL_ID_CF = 'io.wowupcf.jliddev' // Bundle ID
export const BUILD_FLAVOR = import.meta.env.MAIN_VITE_BUILD_FLAVOR

export const IS_WAGO = BUILD_FLAVOR === 'wago'
export const IS_OW = BUILD_FLAVOR === 'ow'
export const IS_PORTABLE = !!process.env.PORTABLE_EXECUTABLE_DIR

export const ADDON_PROVIDER_HUB = 'WowUpHub'
export const ADDON_PROVIDER_WAGO = 'Wago'
export const ADDON_PROVIDER_CURSEFORGE = 'Curse'
export const ADDON_PROVIDER_WOWINTERFACE = 'WowInterface'
export const ADDON_PROVIDER_TUKUI = 'TukUI'

export const TYPES = {
  INetworkService: Symbol.for('INetworkService'),
  IRendererMessageService: Symbol.for('IRendererMessageService'),
  IAddonProvider: Symbol.for('IAddonProvider'),
  IAddonStoreService: Symbol.for('IAddonStoreService'),
  ITocService: Symbol.for('ITocService')
}

export const TAGS = {
  CurseForgeProvider: 'CurseForgeProvider',
  NetworkService: 'NetworkService',
  TukUiProvider: 'TukUiProvider',
  WowUpProvider: 'WowUpProvider'
}
