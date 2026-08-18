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
  | 'Wago';

export type AddonScanType = 'wowup' | 'curseforge';

export enum AddonChannelType {
  Stable,
  Beta,
  Alpha,
}

export enum AddonDependencyType {
  Embedded = 1,
  Required = 2,
  Optional = 3,
  Other = 4,
}

export enum AddonWarningType {
  GameVersionTocMissing = 'game-version-toc-missing',
  MissingOnProvider = 'missing-on-provider',
  NoProviderFiles = 'no-provider-files',
  TocNameMismatch = 'toc-name-mismatch',
}

export type AddonIgnoreReason = 'git_repo' | 'missing_dependency' | 'unknown';

export enum AddonCategory {
  Unknown,
  AllAddons = 1,
  Achievements,
  ActionBars,
  AuctionEconomy,
  BagsInventory,
  BossEncounters,
  BuffsDebuffs,
  Bundles,
  ChatCommunication,
  Class,
  Combat,
  Companions,
  DataExport,
  DevelopmentTools,
  Guild,
  Libraries,
  Mail,
  MapMinimap,
  Miscellaneous,
  Missions,
  Plugins,
  Professions,
  PVP,
  QuestsLeveling,
  Roleplay,
  Tooltips,
  UnitFrames,
}

// Various client types that WoW has to offer
export enum WowClientType {
  Retail = 0,
  Classic,
  RetailPtr,
  ClassicPtr,
  Beta,
  ClassicBeta,
  ClassicEra,
  ClassicEraPtr,
  RetailXPtr,
  Anniversary,
  None,
}

// Grouping of the various clients into their expansions
export enum WowClientGroup {
  Retail,
  BurningCrusade,
  Classic,
  WOTLK,
  Cata,
  Mists,
}

export enum WowGameType {
  Retail = 'retail',
  Classic = 'classic',
  BurningCrusade = 'burningCrusade',
  WOTLK = 'wotlk',
  Cata = 'cata',
  Mists = 'mists',
}
