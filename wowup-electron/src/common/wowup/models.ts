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

export enum AppUpdateState {
  CheckingForUpdate = 1,
  UpdateAvailable,
  UpdateNotAvailable,
  Downloading,
  Downloaded,
  Error,
}

export interface AppUpdateEvent {
  state: AppUpdateState;
  progress?: AppUpdateDownloadProgress;
  error?: string;
}

export interface AppUpdateDownloadProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export enum AddonWarningType {
  MissingOnProvider = "missing-on-provider",
  NoProviderFiles = "no-provider-files",
  TocNameMismatch = "toc-name-mismatch",
}

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

export interface AddonDependency {
  externalAddonId: string;
  type: AddonDependencyType;
}

export interface AppOptions {
  serve?: boolean;
  hidden?: boolean;
  quit?: boolean;
}

export interface MenuConfig {
  editLabel: string;
  viewLabel: string;
  zoomOutLabel: string;
  zoomInLabel: string;
  zoomResetLabel: string;
  reloadLabel: string;
  forceReloadLabel: string;
  toggleDevToolsLabel: string;
  toggleFullScreenLabel: string;
  quitLabel: string;
  undoLabel: string;
  redoLabel: string;
  cutLabel: string;
  copyLabel: string;
  pasteLabel: string;
  selectAllLabel: string;
  windowLabel: string;
  windowCloseLabel: string;
}

export interface SystemTrayConfig {
  showLabel: string;
  quitLabel: string;
  checkUpdateLabel: string;
}

export interface WowUpScanResult {
  fileCount: number;
  fileFingerprints: string[];
  fingerprint: string;
  folderName: string;
  path: string;
}

export type PushAction = "addon-update";

export interface PushNotification<T extends PushNotificationData | string> {
  action: PushAction;
  sender: string;
  message: string | T;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PushNotificationData {}

export interface AddonUpdatePushNotification extends PushNotificationData {
  provider: string;
  addonName: string;
  addonId: string;
}

export interface AdPageOptions {
  pageUrl: string;
  referrer?: string;
  userAgent?: string;
  partition?: string;
  preloadFilePath?: string;
  explanationKey?: string; // locale key of the translated explanation of this ad
}
