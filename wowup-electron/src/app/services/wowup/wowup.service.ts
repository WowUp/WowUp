import { Injectable } from "@angular/core";
import { remote } from "electron";
import { UpdateCheckResult } from "electron-updater";
import { existsSync } from "fs";
import { join } from "path";
import { Subject } from "rxjs";
import {
  APP_UPDATE_CHECK_END,
  APP_UPDATE_CHECK_FOR_UPDATE,
  APP_UPDATE_CHECK_START,
  APP_UPDATE_DOWNLOADED,
  APP_UPDATE_INSTALL,
  APP_UPDATE_START_DOWNLOAD,
  COLLAPSE_TO_TRAY_PREFERENCE_KEY,
  DEFAULT_AUTO_UPDATE_PREFERENCE_KEY_SUFFIX,
  DEFAULT_CHANNEL_PREFERENCE_KEY_SUFFIX,
  ENABLE_SYSTEM_NOTIFICATIONS_PREFERENCE_KEY,
  LAST_SELECTED_WOW_CLIENT_TYPE_PREFERENCE_KEY,
  START_MINIMIZED_PREFERENCE_KEY,
  START_WITH_SYSTEM_PREFERENCE_KEY,
  USE_HARDWARE_ACCELERATION_PREFERENCE_KEY,
  WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY,
} from "../../../common/constants";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { AddonChannelType } from "../../models/wowup/addon-channel-type";
import { PreferenceChange } from "../../models/wowup/preference-change";
import { WowUpReleaseChannelType } from "../../models/wowup/wowup-release-channel-type";
import { getEnumList, getEnumName } from "../../utils/enum.utils";
import { ElectronService } from "../electron/electron.service";
import { FileService } from "../files/file.service";
import { PreferenceStorageService } from "../storage/preference-storage.service";

var autoLaunch = require("auto-launch");

@Injectable({
  providedIn: "root",
})
export class WowUpService {
  private readonly _preferenceChangeSrc = new Subject<PreferenceChange>();
  private readonly _wowupUpdateDownloadInProgressSrc = new Subject<boolean>();
  private readonly _wowupUpdateDownloadedSrc = new Subject<any>();
  private readonly _wowupUpdateCheckSrc = new Subject<UpdateCheckResult>();
  private readonly _wowupUpdateCheckInProgressSrc = new Subject<boolean>();

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
  public readonly wowupUpdateDownloaded$ = this._wowupUpdateDownloadedSrc.asObservable();
  public readonly wowupUpdateDownloadInProgress$ = this._wowupUpdateDownloadInProgressSrc.asObservable();
  public readonly wowupUpdateCheck$ = this._wowupUpdateCheckSrc.asObservable();
  public readonly wowupUpdateCheckInProgress$ = this._wowupUpdateCheckInProgressSrc.asObservable();

  constructor(
    private _preferenceStorageService: PreferenceStorageService,
    private _electronService: ElectronService,
    private _fileService: FileService,
  ) {
    this.setDefaultPreferences();

    this.applicationVersion = _electronService.remote.app.getVersion();
    this.isBetaBuild =
      this.applicationVersion.toLowerCase().indexOf("beta") != -1;

    this.createDownloadDirectory().then(() => this.cleanupDownloads());

    this._electronService.renderedEventSrc$.subscribe((evt) => {
      switch (evt) {
        case APP_UPDATE_CHECK_START:
          console.log(APP_UPDATE_CHECK_START);
          this._wowupUpdateCheckInProgressSrc.next(true);
          break;
        case APP_UPDATE_CHECK_END:
          console.log(APP_UPDATE_CHECK_END);
          this._wowupUpdateCheckInProgressSrc.next(false);
          break;
        case APP_UPDATE_START_DOWNLOAD:
          console.log(APP_UPDATE_START_DOWNLOAD);
          this._wowupUpdateDownloadInProgressSrc.next(true);
          break;
        case APP_UPDATE_DOWNLOADED:
          console.log(APP_UPDATE_DOWNLOADED);
          this._wowupUpdateDownloadInProgressSrc.next(false);
          break;
      }
    });
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

  public get startWithSystem() {
    const preference = this._preferenceStorageService.findByKey(
      START_WITH_SYSTEM_PREFERENCE_KEY
    );
    return preference === "true";
  }

  public set startWithSystem(value: boolean) {
    const key = START_WITH_SYSTEM_PREFERENCE_KEY;
    this._preferenceStorageService.set(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });

    this.setAutoStartup();
  }

  public get startMinimized() {
    const preference = this._preferenceStorageService.findByKey(
      START_MINIMIZED_PREFERENCE_KEY
    );
    return preference === "true";
  }

  public set startMinimized(value: boolean) {
    const key = START_MINIMIZED_PREFERENCE_KEY;
    this._preferenceStorageService.set(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });

    this.setAutoStartup();
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

  public async checkForAppUpdate(): Promise<UpdateCheckResult> {
    const updateCheckResult: UpdateCheckResult = await this._electronService.invoke(
      APP_UPDATE_CHECK_FOR_UPDATE
    );

    // only notify things when the version changes
    if (
      updateCheckResult && 
      updateCheckResult.updateInfo && 
      updateCheckResult.updateInfo.version !== this._electronService.getVersionNumber()
    ) {
      this._wowupUpdateCheckSrc.next(updateCheckResult);
    }

    return updateCheckResult;
  }

  public async downloadUpdate() {
    const downloadResult = await this._electronService.invoke(
      APP_UPDATE_START_DOWNLOAD
    );

    this._wowupUpdateDownloadedSrc.next(downloadResult);
    return downloadResult;
  }

  public async installUpdate() {
    return await this._electronService.invoke(APP_UPDATE_INSTALL);
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

  private setAutoStartup() {
    if (this._electronService.isLinux) {
      var autoLauncher = new autoLaunch({
        name: "WowUp",
        isHidden: this.startMinimized,
      });

      if (this.startWithSystem) autoLauncher.enable();
      else autoLauncher.disable();
    } else {
      this._electronService.remote.app.setLoginItemSettings({
        openAtLogin: this.startWithSystem,
        openAsHidden: this._electronService.isMac ? this.startMinimized : false,
        args: this._electronService.isWin
          ? this.startMinimized
            ? ["--hidden"]
            : []
          : [],
      });
    }
  }
}
