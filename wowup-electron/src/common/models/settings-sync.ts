/** Shared request/response types for settings sync (main: `app/services/sync`, renderer: `services/api/settings-sync-api.service.ts`). */

/** One addon as it is written into the shared addon list; the same shape as the import/export string */
export interface SettingsSyncAddon {
  name: string;
  provider_name: string;
  id: string;
  version_id?: string;
}

/** The addon list of one device, as last pushed by that device */
export interface SettingsSyncDeviceAddons {
  deviceId: string;
  deviceName: string;
  updatedAt: number;
  /** WowClientType enum name, e.g. "Forever"; matches `ExportPayload.client_type` */
  clientType: string;
  addons: SettingsSyncAddon[];
}

export interface SettingsSyncStatus {
  /** A sync code is saved on this device */
  hasCode: boolean;
  /** The first group of the code, enough to tell two codes apart without showing the secret */
  codeHint?: string;
  folderPath?: string;
  autoSync: boolean;
  installationIds: string[];
  lastResults: { [installationId: string]: SettingsSyncResult };
}

export type SettingsSyncFileChange = "downloaded" | "uploaded" | "deleted-local" | "deleted-remote";

export interface SettingsSyncResult {
  installationId: string;
  finishedAt: number;
  /** "first-device": nothing was stored for this code and game yet, so this device's files seeded it */
  outcome: "synced" | "no-changes" | "first-device";
  downloaded: number;
  uploaded: number;
  deletedLocal: number;
  deletedRemote: number;
  /** Paths (relative to WTF) changed on both sides since the last sync; the newest copy won */
  conflicts: string[];
  /** Zip written to the WTF backup folder before any local file was changed */
  backupPath?: string;
  /** Addon lists the other devices pushed for the same game, newest first */
  otherDevices: SettingsSyncDeviceAddons[];
}

/** Error messages main throws that the renderer branches on; ipc keeps only an error's message */
export const SETTINGS_SYNC_ERROR_GAME_RUNNING = "SETTINGS_SYNC_GAME_RUNNING";
export const SETTINGS_SYNC_ERROR_NOT_CONFIGURED = "SETTINGS_SYNC_NOT_CONFIGURED";
export const SETTINGS_SYNC_ERROR_INVALID_CODE = "SETTINGS_SYNC_INVALID_CODE";
export const SETTINGS_SYNC_ERROR_FOLDER_MISSING = "SETTINGS_SYNC_FOLDER_MISSING";
export const SETTINGS_SYNC_ERROR_WRONG_KEY = "SETTINGS_SYNC_WRONG_KEY";
export const SETTINGS_SYNC_ERROR_BUSY = "SETTINGS_SYNC_BUSY";
