export enum WagoMessage {
  GetPreloadPath = 'wago.get-preload-path',
  TokenReceived = 'wago.token-received'
}

export enum AddonMessage {
  ScanAddonFolder = 'addon.scan-folder',
  GetAddonList = 'addon.get-addons',
  ScanningAddonProvider = 'addon.scanning-addon-provider'
}

export enum OsMessage {
  ShowFileInFolder = 'os.show-file-in-folder',
  ShowAppDataFolder = 'os.show-app-data-folder'
}
