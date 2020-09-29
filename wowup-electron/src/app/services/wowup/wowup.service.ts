import { Injectable } from "@angular/core";
import { CachingService } from "../caching/caching-service";
import { remote } from "electron";
import { join } from 'path';
import { existsSync, copyFile } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { WowUpReleaseChannelType } from "app/models/wowup/wowup-release-channel-type";
import { getEnumKeys, getEnumList, getEnumName } from "app/utils/enum.utils";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { AddonChannelType } from "app/models/wowup/addon-channel-type";
import { ElectronService } from "../electron/electron.service";
import { WowUpApiService } from "../wowup-api/wowup-api.service";
import { AppConfig } from '../../../environments/environment';
import { from, Observable, of, Subject } from "rxjs";
import { LatestVersionResponse } from "app/models/wowup-api/latest-version-response";
import { map, switchMap } from "rxjs/operators";
import { LatestVersion } from "app/models/wowup-api/latest-version";
import * as compareVersions from 'compare-versions';
import { DownloadSevice } from "../download/download.service";
import { Preferences } from "../../../constants";
import { PreferenceChange } from "app/models/wowup/preference-change";
import { FileService } from "../files/file.service";

const LATEST_VERSION_CACHE_KEY = 'latest-version-response';

@Injectable({
  providedIn: 'root'
})
export class WowUpService {

  private readonly _preferenceChangeSrc = new Subject<PreferenceChange>();

  public readonly updaterName = 'WowUpUpdater.exe';
  public readonly applicationFolderPath: string = remote.app.getPath('userData');
  public readonly applicationLogsFolderPath: string = remote.app.getPath('logs');
  public readonly applicationDownloadsFolderPath: string = join(this.applicationFolderPath, 'downloads');
  public readonly applicationUpdaterPath: string = join(this.applicationFolderPath, this.updaterName);
  public readonly applicationVersion: string;
  public readonly isBetaBuild: boolean;
  public readonly preferenceChange$ = this._preferenceChangeSrc.asObservable();

  constructor(
    private _preferenceStorageService: PreferenceStorageService,
    private _downloadService: DownloadSevice,
    private _electronService: ElectronService,
    private _fileService: FileService,
    private _cacheService: CachingService,
    private _wowUpApiService: WowUpApiService
  ) {
    this.setDefaultPreferences();

    this.applicationVersion = _electronService.remote.app.getVersion();
    this.isBetaBuild = this.applicationVersion.toLowerCase().indexOf('beta') != -1;
  }

  public get updaterExists() {
    return existsSync(this.applicationUpdaterPath);
  }

  public get collapseToTray() {
    const preference = this._preferenceStorageService.findByKey(Preferences.collapseToTrayKey);
    return preference === 'true';
  }

  public set collapseToTray(value: boolean) {
    const key = Preferences.collapseToTrayKey;
    this._preferenceStorageService.set(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() })
  }

  public get telemetryEnabled() {
    const preference = this._preferenceStorageService.findByKey(Preferences.telemetryEnabledKey);
    return preference === 'true';
  }

  public set telemetryEnabled(value: boolean) {
    const key = Preferences.telemetryEnabledKey;
    this._preferenceStorageService.set(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() })
  }

  public get wowUpReleaseChannel() {
    const preference = this._preferenceStorageService.findByKey(Preferences.wowupReleaseChannelKey);
    return parseInt(preference, 10) as WowUpReleaseChannelType;
  }

  public set wowUpReleaseChannel(releaseChannel: WowUpReleaseChannelType) {
    this._preferenceStorageService.set(Preferences.wowupReleaseChannelKey, releaseChannel);
  }

  public get lastSelectedClientType(): WowClientType {
    const preference = this._preferenceStorageService.findByKey(Preferences.lastSelectedWowClientTypeKey);
    const value = parseInt(preference, 10);
    return isNaN(value)
      ? WowClientType.None
      : value as WowClientType;
  }

  public set lastSelectedClientType(clientType: WowClientType) {
    this._preferenceStorageService.set(Preferences.lastSelectedWowClientTypeKey, clientType);
  }

  public showLogsFolder() {
    this._fileService.showDirectory(this.applicationLogsFolderPath);
  }

  public isUpdateAvailable(): Observable<boolean> {
    const releaseChannel = this.wowUpReleaseChannel;

    return this.getLatestWowUpVersion(releaseChannel)
      .pipe(
        map(response => {
          if (!response?.version) {
            console.error("Got empty WowUp version");
            return false;
          }

          if (this.isBetaBuild && releaseChannel != WowUpReleaseChannelType.Beta) {
            return true;
          }

          return compareVersions(response.version, AppConfig.appVersion) > 0;
        })
      );
  }

  public getLatestWowUpVersion(channel: WowUpReleaseChannelType): Observable<LatestVersion> {
    const cachedResponse = this._cacheService.get<LatestVersionResponse>(LATEST_VERSION_CACHE_KEY);
    if (cachedResponse) {
      return of(channel === WowUpReleaseChannelType.Beta ? cachedResponse.beta : cachedResponse.stable);
    }
    return this._wowUpApiService.getLatestVersion()
      .pipe(
        map(response => {
          this._cacheService.set(LATEST_VERSION_CACHE_KEY, response);
          return channel === WowUpReleaseChannelType.Beta ? response.beta : response.stable;
        })
      );
  }

  public getLatestUpdaterVersion() {
    return this._wowUpApiService.getLatestVersion()
      .pipe(
        map(response => {
          return response.updater;
        })
      );
  }

  public installUpdate() {
    // TODO
  }

  public checkUpdaterApp(onProgress?: (progress: number) => void): Observable<void> {
    if (this.updaterExists) {
      return of(undefined);
    } else {
      return this.installUpdater(onProgress);
    }
  }

  private installUpdater(onProgress?: (progress: number) => void): Observable<void> {
    return this.getLatestUpdaterVersion()
      .pipe(
        switchMap(response => from(this._downloadService.downloadZipFile(response.url, this.applicationDownloadsFolderPath, onProgress))),
        switchMap(downloadedPath => {
          const unzipPath = join(this.applicationDownloadsFolderPath, uuidv4());
          return from(this._downloadService.unzipFile(downloadedPath, unzipPath));
        }),
        switchMap(unzippedDir => {
          console.log(unzippedDir);
          const newUpdaterPath = join(unzippedDir, this.updaterName);
          return from(this._downloadService.copyFile(newUpdaterPath, this.applicationUpdaterPath));
        }),
        map(() => {
          console.log('DOWNLOAD COMPLETE')
        })
      )
  }

  private setDefaultPreference(key: string, defaultValue: any) {
    let pref = this._preferenceStorageService.findByKey(key);
    if (!pref) {
      this._preferenceStorageService.set(key, defaultValue.toString());
    }
  }

  private getClientDefaultAddonChannelKey(clientType: WowClientType) {
    const typeName = getEnumName(WowClientType, clientType);
    return `${typeName}${Preferences.defaultChannelKeySuffix}`.toLowerCase();
  }

  private setDefaultPreferences() {
    this.setDefaultPreference(Preferences.collapseToTrayKey, true);
    this.setDefaultPreference(Preferences.wowupReleaseChannelKey, this.getDefaultReleaseChannel());
    this.setDefaultClientPreferences();
  }

  private setDefaultClientPreferences() {
    const keys = getEnumList<WowClientType>(WowClientType).filter(key => key !== WowClientType.None);
    keys.forEach(key => {
      const preferenceKey = this.getClientDefaultAddonChannelKey(key);
      this.setDefaultPreference(preferenceKey, AddonChannelType.Stable);
    })
  }

  private getDefaultReleaseChannel() {
    return this.isBetaBuild ? WowUpReleaseChannelType.Beta : WowUpReleaseChannelType.Stable;
  }
}