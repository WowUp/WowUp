import { Injectable } from "@angular/core";
import { CachingService } from "../caching/caching-service";
import { remote } from "electron";
import * as _ from "lodash";
import { join } from "path";
import { existsSync } from "fs";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { WowUpReleaseChannelType } from "app/models/wowup/wowup-release-channel-type";
import { getEnumList, getEnumName } from "app/utils/enum.utils";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { AddonChannelType } from "app/models/wowup/addon-channel-type";
import { ElectronService } from "../electron/electron.service";
import { WowUpApiService } from "../wowup-api/wowup-api.service";
import { Observable, of, Subject } from "rxjs";
import { LatestVersionResponse } from "app/models/wowup-api/latest-version-response";
import { map } from "rxjs/operators";
import { LatestVersion } from "app/models/wowup-api/latest-version";
import * as compareVersions from "compare-versions";
import { PreferenceChange } from "app/models/wowup/preference-change";
import { FileService } from "../files/file.service";
import {
  COLLAPSE_TO_TRAY_PREFERENCE_KEY,
  DEFAULT_AUTO_UPDATE_PREFERENCE_KEY_SUFFIX,
  DEFAULT_CHANNEL_PREFERENCE_KEY_SUFFIX,
  ENABLE_SYSTEM_NOTIFICATIONS_PREFERENCE_KEY,
  LAST_SELECTED_WOW_CLIENT_TYPE_PREFERENCE_KEY,
  WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY,
  USE_HARDWARE_ACCELERATION_PREFERENCE_KEY,
  PROMPT_LEGACY_IMPORT_PREFERENCE_KEY,
  READ_SQL_DATABASE_CHANNEL,
  TELEMETRY_ENABLED_PREFERENCE_KEY,
  TELEMETRY_PROMPT_SEND_PREFERENCE_KEY,
} from "common/constants";
import {
  LegacyAddon,
  LegacyDatabaseData,
  LegacyDatabaseDataRaw,
  LegacyPreference,
  LegacyResultSet,
} from "common/wowup/legacy-database";

const LATEST_VERSION_CACHE_KEY = "latest-version-response";

@Injectable({
  providedIn: "root",
})
export class WowUpService {
  private readonly _preferenceChangeSrc = new Subject<PreferenceChange>();

  public readonly updaterName = "WowUpUpdater.exe";
  public readonly applicationFolderPath: string = remote.app.getPath(
    "userData"
  );
  public readonly applicationLogsFolderPath: string = remote.app.getPath(
    "logs"
  );
  public readonly applicationDownloadsFolderPath: string = join(
    this.applicationFolderPath,
    "downloads"
  );
  public readonly applicationUpdaterPath: string = join(
    this.applicationFolderPath,
    this.updaterName
  );
  public readonly applicationVersion: string;
  public readonly isBetaBuild: boolean;
  public readonly preferenceChange$ = this._preferenceChangeSrc.asObservable();

  constructor(
    private _preferenceStorageService: PreferenceStorageService,
    private _electronService: ElectronService,
    private _fileService: FileService,
    private _cacheService: CachingService,
    private _wowUpApiService: WowUpApiService
  ) {
    this.setDefaultPreferences();

    this.applicationVersion = _electronService.remote.app.getVersion();
    this.isBetaBuild =
      this.applicationVersion.toLowerCase().indexOf("beta") != -1;

    this.createDownloadDirectory().then(() => this.cleanupDownloads());
  }

  public get legacyDatabasePath() {
    const localAppDataPath = this._electronService.remote.process.env
      .LOCALAPPDATA;

    return join(localAppDataPath, "WowUp", "WowUp.db3");
  }

  public get updaterExists() {
    return existsSync(this.applicationUpdaterPath);
  }

  public get shouldPromptLegacyImport() {
    return (
      this._preferenceStorageService.get(
        PROMPT_LEGACY_IMPORT_PREFERENCE_KEY
      ) === undefined
    );
  }

  public get collapseToTray() {
    const preference = this._preferenceStorageService.findByKey(
      COLLAPSE_TO_TRAY_PREFERENCE_KEY
    );
    return preference === "true";
  }

  public set collapseToTray(value: boolean) {
    const key = COLLAPSE_TO_TRAY_PREFERENCE_KEY;
    this._preferenceStorageService.set(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });
  }

  public get useHardwareAcceleration() {
    const preference = this._preferenceStorageService.findByKey(
      USE_HARDWARE_ACCELERATION_PREFERENCE_KEY
    );
    return preference === "true";
  }

  public set useHardwareAcceleration(value: boolean) {
    const key = USE_HARDWARE_ACCELERATION_PREFERENCE_KEY;
    this._preferenceStorageService.set(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });
  }

  public get wowUpReleaseChannel() {
    const preference = this._preferenceStorageService.findByKey(
      WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY
    );
    return parseInt(preference, 10) as WowUpReleaseChannelType;
  }

  public set wowUpReleaseChannel(releaseChannel: WowUpReleaseChannelType) {
    this._preferenceStorageService.set(
      WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY,
      releaseChannel
    );
  }

  public get lastSelectedClientType(): WowClientType {
    const preference = this._preferenceStorageService.findByKey(
      LAST_SELECTED_WOW_CLIENT_TYPE_PREFERENCE_KEY
    );
    const value = parseInt(preference, 10);
    return isNaN(value) ? WowClientType.None : (value as WowClientType);
  }

  public set lastSelectedClientType(clientType: WowClientType) {
    this._preferenceStorageService.set(
      LAST_SELECTED_WOW_CLIENT_TYPE_PREFERENCE_KEY,
      clientType
    );
  }

  public get enableSystemNotifications() {
    return (
      this._preferenceStorageService.findByKey(
        ENABLE_SYSTEM_NOTIFICATIONS_PREFERENCE_KEY
      ) === true.toString()
    );
  }

  public set enableSystemNotifications(enabled: boolean) {
    this._preferenceStorageService.set(
      ENABLE_SYSTEM_NOTIFICATIONS_PREFERENCE_KEY,
      enabled
    );
  }

  public get showLegacyImportPrompt(): boolean {
    return (
      this._preferenceStorageService.get(
        PROMPT_LEGACY_IMPORT_PREFERENCE_KEY
      ) !== false.toString()
    );
  }

  public set showLegacyImportPrompt(enabled: boolean) {
    this._preferenceStorageService.set(
      PROMPT_LEGACY_IMPORT_PREFERENCE_KEY,
      enabled
    );
  }

  public getClientDefaultAddonChannelKey(clientType: WowClientType) {
    const typeName = getEnumName(WowClientType, clientType);
    return `${typeName}${DEFAULT_CHANNEL_PREFERENCE_KEY_SUFFIX}`.toLowerCase();
  }

  public getDefaultAddonChannel(clientType: WowClientType): AddonChannelType {
    const key = this.getClientDefaultAddonChannelKey(clientType);
    const preference = this._preferenceStorageService.findByKey(key);
    return parseInt(preference, 10) as AddonChannelType;
  }

  public setDefaultAddonChannel(
    clientType: WowClientType,
    channelType: AddonChannelType
  ) {
    const key = this.getClientDefaultAddonChannelKey(clientType);
    this._preferenceStorageService.set(key, channelType);
    this._preferenceChangeSrc.next({ key, value: channelType.toString() });
  }

  public getDefaultAutoUpdate(clientType: WowClientType): boolean {
    const key = this.getClientDefaultAutoUpdateKey(clientType);
    const preference = this._preferenceStorageService.findByKey(key);
    return preference === true.toString();
  }

  public setDefaultAutoUpdate(clientType: WowClientType, autoUpdate: boolean) {
    const key = this.getClientDefaultAutoUpdateKey(clientType);
    this._preferenceStorageService.set(key, autoUpdate);
  }

  public showLogsFolder() {
    this._fileService.showDirectory(this.applicationLogsFolderPath);
  }

  public isUpdateAvailable(): Observable<boolean> {
    const releaseChannel = this.wowUpReleaseChannel;

    return this.getLatestWowUpVersion(releaseChannel).pipe(
      map((response) => {
        if (!response?.version) {
          console.error("Got empty WowUp version");
          return false;
        }

        if (
          this.isBetaBuild &&
          releaseChannel != WowUpReleaseChannelType.Beta
        ) {
          return true;
        }

        return (
          compareVersions(
            response.version,
            this._electronService.remote.app.getVersion()
          ) > 0
        );
      })
    );
  }

  public getLatestWowUpVersion(
    channel: WowUpReleaseChannelType
  ): Observable<LatestVersion> {
    const cachedResponse = this._cacheService.get<LatestVersionResponse>(
      LATEST_VERSION_CACHE_KEY
    );
    if (cachedResponse) {
      return of(
        channel === WowUpReleaseChannelType.Beta
          ? cachedResponse.beta
          : cachedResponse.stable
      );
    }
    return this._wowUpApiService.getLatestVersion().pipe(
      map((response) => {
        this._cacheService.set(LATEST_VERSION_CACHE_KEY, response);
        return channel === WowUpReleaseChannelType.Beta
          ? response.beta
          : response.stable;
      })
    );
  }

  public getLatestUpdaterVersion() {
    return this._wowUpApiService.getLatestVersion().pipe(
      map((response) => {
        return response.updater;
      })
    );
  }

  public async legacyAppExists() {
    if (!this._electronService.isWin) {
      return false;
    }

    return await this._fileService.pathExists(this.legacyDatabasePath);
  }

  public async importLegacyDatabse(): Promise<LegacyDatabaseData> {
    const legacyDatabase: LegacyDatabaseDataRaw = await this._electronService.ipcRenderer.invoke(
      READ_SQL_DATABASE_CHANNEL,
      this.legacyDatabasePath
    );

    const legacyData = this.parseLegacyDatabase(legacyDatabase);

    this.importLegacyPreferences(legacyData.preferences);

    return legacyData;
  }

  private setDefaultPreference(key: string, defaultValue: any) {
    let pref = this._preferenceStorageService.findByKey(key);
    if (!pref) {
      this._preferenceStorageService.set(key, defaultValue.toString());
    }
  }

  private getClientDefaultAutoUpdateKey(clientType: WowClientType): string {
    const typeName = getEnumName(WowClientType, clientType);
    return `${typeName}${DEFAULT_AUTO_UPDATE_PREFERENCE_KEY_SUFFIX}`.toLowerCase();
  }

  private setDefaultPreferences() {
    this.setDefaultPreference(ENABLE_SYSTEM_NOTIFICATIONS_PREFERENCE_KEY, true);
    this.setDefaultPreference(COLLAPSE_TO_TRAY_PREFERENCE_KEY, true);
    this.setDefaultPreference(USE_HARDWARE_ACCELERATION_PREFERENCE_KEY, true);
    this.setDefaultPreference(
      WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY,
      this.getDefaultReleaseChannel()
    );
    this.setDefaultClientPreferences();
  }

  private setDefaultClientPreferences() {
    const keys = getEnumList<WowClientType>(WowClientType).filter(
      (key) => key !== WowClientType.None
    );
    keys.forEach((key) => {
      const preferenceKey = this.getClientDefaultAddonChannelKey(key);
      this.setDefaultPreference(preferenceKey, AddonChannelType.Stable);

      const autoUpdateKey = this.getClientDefaultAutoUpdateKey(key);
      this.setDefaultPreference(autoUpdateKey, false);
    });
  }

  private getDefaultReleaseChannel() {
    return this.isBetaBuild
      ? WowUpReleaseChannelType.Beta
      : WowUpReleaseChannelType.Stable;
  }

  /**
   * Clean up lost downloads in the download folder
   */
  private async cleanupDownloads() {
    const downloadFiles = this._fileService.listEntries(
      this.applicationDownloadsFolderPath,
      "*"
    );

    for (let entry of downloadFiles) {
      const path = join(this.applicationDownloadsFolderPath, entry.name);
      try {
        await this._fileService.remove(path);
      } catch (e) {
        console.error("Failed to delete download entry", path);
        console.error(e);
      }
    }
  }

  private async createDownloadDirectory() {
    await this._fileService.createDirectory(
      this.applicationDownloadsFolderPath
    );
  }

  private parseLegacyDatabase(data: LegacyDatabaseDataRaw): LegacyDatabaseData {
    const addons = this.mapLegacyResultSet<LegacyAddon>(data.addons[0]);
    const preferences = this.mapLegacyResultSet<LegacyPreference>(
      data.preferences[0]
    );

    return { addons, preferences };
  }

  private mapLegacyResultSet<T>(resultSet: LegacyResultSet): T[] {
    return resultSet.values.map((values, valueIdx) => {
      const object = {};
      resultSet.columns.forEach((col, colIdx) => {
        object[col] = values[colIdx];
      });
      return object as T;
    });
  }

  private importLegacyPreferences(preferences: LegacyPreference[]) {
    const telemetryPromptPreference = _.find(
      preferences,
      (p) => p.Key === TELEMETRY_PROMPT_SEND_PREFERENCE_KEY
    );
    if (telemetryPromptPreference) {
      console.debug(
        `Importing legacy preference: ${TELEMETRY_PROMPT_SEND_PREFERENCE_KEY}=${telemetryPromptPreference.Value}`
      );
      this._preferenceStorageService.set(
        TELEMETRY_PROMPT_SEND_PREFERENCE_KEY,
        telemetryPromptPreference.Value === "True"
      );
    }

    const telemetryPreference = _.find(
      preferences,
      (p) => p.Key === TELEMETRY_ENABLED_PREFERENCE_KEY
    );
    if (telemetryPreference) {
      console.debug(
        `Importing legacy preference: ${TELEMETRY_ENABLED_PREFERENCE_KEY}=${telemetryPreference.Value}`
      );
      this._preferenceStorageService.set(
        TELEMETRY_ENABLED_PREFERENCE_KEY,
        telemetryPreference.Value === "True"
      );
    }

    const lastSelectedClientPreference = _.find(
      preferences,
      (p) => p.Key === LAST_SELECTED_WOW_CLIENT_TYPE_PREFERENCE_KEY
    );
    if (lastSelectedClientPreference) {
      const clientType = WowClientType[lastSelectedClientPreference.Value];
      console.debug(
        `Importing legacy preference: ${LAST_SELECTED_WOW_CLIENT_TYPE_PREFERENCE_KEY}=${clientType}`
      );
      this.lastSelectedClientType = clientType;
    }

    const collapseToTrayPreference = _.find(
      preferences,
      (p) => p.Key === COLLAPSE_TO_TRAY_PREFERENCE_KEY
    );
    if (collapseToTrayPreference) {
      console.debug(
        `Importing legacy preference: ${COLLAPSE_TO_TRAY_PREFERENCE_KEY}=${collapseToTrayPreference.Value}`
      );
      this.collapseToTray = collapseToTrayPreference.Value === "True";
    }

    const clientTypes = getEnumList<WowClientType>(WowClientType).filter(
      (clientType) => clientType !== WowClientType.None
    );

    clientTypes.forEach((clientType) => {
      const autoUpdateKey = this.getClientDefaultAutoUpdateKey(clientType);
      const channelKey = this.getClientDefaultAddonChannelKey(clientType);

      const autoUpdatePreference = _.find(
        preferences,
        (p) => p.Key === autoUpdateKey
      );

      const channelPreference = _.find(
        preferences,
        (p) => p.Key === channelKey
      );

      if (autoUpdatePreference) {
        console.debug(
          `Importing legacy preference: ${autoUpdateKey}=${autoUpdatePreference.Value}`
        );
        this.setDefaultAutoUpdate(
          clientType,
          autoUpdatePreference.Value === "True"
        );
      }

      if (channelPreference) {
        const channel: AddonChannelType =
          AddonChannelType[channelPreference.Value];
        console.debug(`Importing legacy preference: ${channelKey}=${channel}`);
        this.setDefaultAddonChannel(clientType, channel);
      }
    });
  }
}
