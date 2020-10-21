import { Injectable } from "@angular/core";
import { CachingService } from "../caching/caching-service";
import { remote } from "electron";
import { join } from "path";
import { existsSync } from "fs";
import { v4 as uuidv4 } from "uuid";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { WowUpReleaseChannelType } from "app/models/wowup/wowup-release-channel-type";
import { getEnumList, getEnumName } from "app/utils/enum.utils";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { AddonChannelType } from "app/models/wowup/addon-channel-type";
import { ElectronService } from "../electron/electron.service";
import { WowUpApiService } from "../wowup-api/wowup-api.service";
import { from, Observable, of, Subject } from "rxjs";
import { LatestVersionResponse } from "app/models/wowup-api/latest-version-response";
import { map, switchMap } from "rxjs/operators";
import { LatestVersion } from "app/models/wowup-api/latest-version";
import * as compareVersions from "compare-versions";
import { DownloadSevice } from "../download/download.service";
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
  ENABLED_ADDON_PROVIDERS_KEY,
} from "common/constants";
import { AddonProviderFactory } from "../addons/addon.provider.factory";
import { AddonProvider } from "../../addon-providers/addon-provider";

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
    private _downloadService: DownloadSevice,
    private _electronService: ElectronService,
    private _fileService: FileService,
    private _cacheService: CachingService,
    private _wowUpApiService: WowUpApiService,
    private _addonProviderFactory: AddonProviderFactory
  ) {
    this.setDefaultPreferences();

    this.applicationVersion = _electronService.remote.app.getVersion();
    this.isBetaBuild =
      this.applicationVersion.toLowerCase().indexOf("beta") != -1;

    this.createDownloadDirectory().then(() => this.cleanupDownloads());
  }

  public get updaterExists() {
    return existsSync(this.applicationUpdaterPath);
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

  public get enabledAddonProviders() {
    const preference = this._preferenceStorageService.findByKey(ENABLED_ADDON_PROVIDERS_KEY)
    return preference.split(',');
  }

  public set enabledAddonProviders(value) {
    const key = ENABLED_ADDON_PROVIDERS_KEY;
    this._preferenceStorageService.set(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() })
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

  public installUpdate() {
    // TODO
  }

  private setDefaultPreference(key: string, defaultValue: any) {
    let pref = this._preferenceStorageService.findByKey(key);
    if (pref === null || pref === undefined) {
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
    this.setDefaultPreference(ENABLED_ADDON_PROVIDERS_KEY, this._addonProviderFactory
      .getAll()
      .map((addonProvider: AddonProvider) => addonProvider.name)
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
}
