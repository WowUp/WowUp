export enum AddonChannelType {
  Stable,
  Beta,
  Alpha
}

export type AddonProviderType =
  | 'Unknown'
  | 'Curse'
  | 'CurseV2'
  | 'GitHub'
  | 'TukUI'
  | 'WowInterface'
  | 'WowUpHub'
  | 'RaiderIO'
  | 'Zip'
  | 'WowUpCompanion'
  | 'Wago'

export interface AddonProviderSettings {
  name: AddonProviderType
  enabled: boolean
  forceIgnore: boolean
  allowReinstall: boolean
  allowChannelChange: boolean
  allowEdit: boolean
  allowViewAtSource: boolean
  allowReScan: boolean
  canShowChangelog: boolean
  canBatchFetch: boolean
  authRequired: boolean
  adRequired: boolean
  providerNote: string
}

export * from './addon'
