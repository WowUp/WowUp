import { Injectable } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { ColumnState } from "../../models/wowup/column-state";
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
  SELECTED_LANGUAGE_PREFERENCE_KEY,
  MY_ADDONS_HIDDEN_COLUMNS_KEY,
  MY_ADDONS_SORT_ORDER,
  GET_ADDONS_HIDDEN_COLUMNS_KEY,
  GET_ADDONS_SORT_ORDER,
  CURRENT_THEME_KEY,
  DEFAULT_THEME,
  HORDE_THEME,
  HORDE_LIGHT_THEME,
  ALLIANCE_THEME,
  ALLIANCE_LIGHT_THEME,
  DEFAULT_LIGHT_THEME,
} from "../../../common/constants";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { AddonChannelType } from "../../models/wowup/addon-channel-type";
import { PreferenceChange } from "../../models/wowup/preference-change";
import { SortOrder } from "../../models/wowup/sort-order";
import { WowUpReleaseChannelType } from "../../models/wowup/wowup-release-channel-type";
import { getEnumList, getEnumName } from "../../utils/enum.utils";
import { ElectronService } from "../electron/electron.service";
import { FileService } from "../files/file.service";
import { PreferenceStorageService } from "../storage/preference-storage.service";

const autoLaunch = require("auto-launch");

@Injectable({
  providedIn: "root",
})
export class WowUpService {
  private readonly _preferenceChangeSrc = new Subject<PreferenceChange>();
  private readonly _wowupUpdateDownloadInProgressSrc = new Subject<boolean>();
  private readonly _wowupUpdateDownloadedSrc = new Subject<any>();
  private readonly _wowupUpdateCheckSrc = new Subject<UpdateCheckResult>();
  private readonly _wowupUpdateCheckInProgressSrc = new Subject<boolean>();
  private _availableVersion = "";

  public readonly updaterName = "WowUpUpdater.exe";

  public readonly applicationFolderPath: string = remote.app.getPath("userData");

  public readonly applicationLogsFolderPath: string = remote.app.getPath("logs");

  public readonly applicationDownloadsFolderPath: string = join(this.applicationFolderPath, "downloads");

  public readonly applicationUpdaterPath: string = join(this.applicationFolderPath, this.updaterName);

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
    private _translateService: TranslateService
  ) {
    this.setDefaultPreferences();

    this.applicationVersion =
      _electronService.remote.app.getVersion() + `${this._electronService.isPortable ? " (portable)" : ""}`;
    this.isBetaBuild = this.applicationVersion.toLowerCase().indexOf("beta") != -1;

    this.createDownloadDirectory().then(() => this.cleanupDownloads());

    this._electronService.ipcEventReceived$.subscribe((evt) => {
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

    this.setAutoStartup();

    console.log("loginItemSettings", this._electronService.loginItemSettings);
  }

  /**
   * This is called before the app component is initialized in order to catch issues
   * with unsupported languages
   */
  async initializeLanguage() {
    console.log("Language setup start");
    const langCode = this.currentLanguage || this._electronService.locale;

    this._translateService.setDefaultLang("en");
    try {
      await this._translateService.use(langCode).toPromise();
      console.log(`using locale ${langCode}`);
      this.currentLanguage = langCode;
    } catch (e) {
      console.warn(`Language ${langCode} not found defaulting to english`);
      this.currentLanguage = "en";
      await this._translateService.use("en").toPromise();
    }

    console.log("Language setup complete");
  }

  public get availableVersion() {
    return this._availableVersion;
  }

  public get updaterExists() {
    return existsSync(this.applicationUpdaterPath);
  }

  public get collapseToTray() {
    const preference = this._preferenceStorageService.findByKey(COLLAPSE_TO_TRAY_PREFERENCE_KEY);
    return preference === "true";
  }

  public set collapseToTray(value: boolean) {
    const key = COLLAPSE_TO_TRAY_PREFERENCE_KEY;
    this._preferenceStorageService.set(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });
  }

  public get currentTheme() {
    return this._preferenceStorageService.get(CURRENT_THEME_KEY) || DEFAULT_THEME;
  }

  public set currentTheme(value: string) {
    const key = CURRENT_THEME_KEY;
    this._preferenceStorageService.set(key, value);
    this._preferenceChangeSrc.next({ key, value: value });
  }

  public get useHardwareAcceleration() {
    const preference = this._preferenceStorageService.findByKey(USE_HARDWARE_ACCELERATION_PREFERENCE_KEY);
    return preference === "true";
  }

  public set useHardwareAcceleration(value: boolean) {
    const key = USE_HARDWARE_ACCELERATION_PREFERENCE_KEY;
    this._preferenceStorageService.set(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });
  }

  public get currentLanguage() {
    const preference = this._preferenceStorageService.findByKey(SELECTED_LANGUAGE_PREFERENCE_KEY);
    console.log("Set Language Preference: " + preference);
    return preference;
  }

  public set currentLanguage(value: string) {
    const key = SELECTED_LANGUAGE_PREFERENCE_KEY;
    this._preferenceStorageService.set(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });
  }

  public get startWithSystem() {
    const preference = this._preferenceStorageService.findByKey(START_WITH_SYSTEM_PREFERENCE_KEY);
    return preference === "true";
  }

  public set startWithSystem(value: boolean) {
    const key = START_WITH_SYSTEM_PREFERENCE_KEY;
    this._preferenceStorageService.set(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });

    this.setAutoStartup();
  }

  public get startMinimized() {
    const preference = this._preferenceStorageService.findByKey(START_MINIMIZED_PREFERENCE_KEY);
    return preference === "true";
  }

  public set startMinimized(value: boolean) {
    const key = START_MINIMIZED_PREFERENCE_KEY;
    this._preferenceStorageService.set(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });

    this.setAutoStartup();
  }

  public get wowUpReleaseChannel() {
    const preference = this._preferenceStorageService.findByKey(WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY);
    return parseInt(preference, 10) as WowUpReleaseChannelType;
  }

  public set wowUpReleaseChannel(releaseChannel: WowUpReleaseChannelType) {
    this._preferenceStorageService.set(WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY, releaseChannel);
  }

  public get lastSelectedClientType(): WowClientType {
    const preference = this._preferenceStorageService.findByKey(LAST_SELECTED_WOW_CLIENT_TYPE_PREFERENCE_KEY);
    const value = parseInt(preference, 10);
    return isNaN(value) ? WowClientType.None : (value as WowClientType);
  }

  public set lastSelectedClientType(clientType: WowClientType) {
    this._preferenceStorageService.set(LAST_SELECTED_WOW_CLIENT_TYPE_PREFERENCE_KEY, clientType);
  }

  public get enableSystemNotifications() {
    return this._preferenceStorageService.findByKey(ENABLE_SYSTEM_NOTIFICATIONS_PREFERENCE_KEY) === true.toString();
  }

  public set enableSystemNotifications(enabled: boolean) {
    this._preferenceStorageService.set(ENABLE_SYSTEM_NOTIFICATIONS_PREFERENCE_KEY, enabled);
  }

  public get myAddonsHiddenColumns() {
    return this._preferenceStorageService.getObject<ColumnState[]>(MY_ADDONS_HIDDEN_COLUMNS_KEY) || [];
  }

  public set myAddonsHiddenColumns(columnStates: ColumnState[]) {
    this._preferenceStorageService.setObject(MY_ADDONS_HIDDEN_COLUMNS_KEY, columnStates);
  }

  public get myAddonsSortOrder(): SortOrder {
    return this._preferenceStorageService.getObject<SortOrder>(MY_ADDONS_SORT_ORDER);
  }

  public set myAddonsSortOrder(sortOrder: SortOrder) {
    this._preferenceStorageService.setObject(MY_ADDONS_SORT_ORDER, sortOrder);
  }

  public get getAddonsHiddenColumns() {
    return this._preferenceStorageService.getObject<ColumnState[]>(GET_ADDONS_HIDDEN_COLUMNS_KEY) || [];
  }

  public set getAddonsHiddenColumns(columnStates: ColumnState[]) {
    this._preferenceStorageService.setObject(GET_ADDONS_HIDDEN_COLUMNS_KEY, columnStates);
  }

  public get getAddonsSortOrder(): SortOrder {
    return this._preferenceStorageService.getObject<SortOrder>(GET_ADDONS_SORT_ORDER);
  }

  public set getAddonsSortOrder(sortOrder: SortOrder) {
    this._preferenceStorageService.setObject(GET_ADDONS_SORT_ORDER, sortOrder);
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

  public setDefaultAddonChannel(clientType: WowClientType, channelType: AddonChannelType) {
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
    const updateCheckResult: UpdateCheckResult = await this._electronService.invoke(APP_UPDATE_CHECK_FOR_UPDATE);

    // only notify things when the version changes
    if (!this.isSameVersion(updateCheckResult)) {
      this._availableVersion = updateCheckResult.updateInfo.version;
      this._wowupUpdateCheckSrc.next(updateCheckResult);
    }

    return updateCheckResult;
  }

  public isSameVersion(updateCheckResult: UpdateCheckResult) {
    return updateCheckResult && updateCheckResult.updateInfo?.version === this._electronService.getVersionNumber();
  }

  public async downloadUpdate() {
    const downloadResult = await this._electronService.invoke(APP_UPDATE_START_DOWNLOAD);

    this._wowupUpdateDownloadedSrc.next(downloadResult);
    return downloadResult;
  }

  public async installUpdate() {
    return await this._electronService.invoke(APP_UPDATE_INSTALL);
  }

  public getThemeLogoPath() {
    switch (this.currentTheme) {
      case HORDE_THEME:
        return "assets/images/horde-1.png";
      case HORDE_LIGHT_THEME:
        return "assets/images/horde-dark-1.png";
      case ALLIANCE_THEME:
        return "assets/images/alliance-1.png";
      case ALLIANCE_LIGHT_THEME:
        return "assets/images/alliance-dark-1.png";
      case DEFAULT_LIGHT_THEME:
        return "assets/images/wowup-dark-1.png";
      case DEFAULT_THEME:
      default:
        return "assets/images/wowup-white-1.png";
    }
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
    this.setDefaultPreference(CURRENT_THEME_KEY, DEFAULT_THEME);
    this.setDefaultPreference(WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY, this.getDefaultReleaseChannel());
    this.setDefaultClientPreferences();
  }

  private setDefaultClientPreferences() {
    const keys = getEnumList<WowClientType>(WowClientType).filter((key) => key !== WowClientType.None);
    keys.forEach((key) => {
      const preferenceKey = this.getClientDefaultAddonChannelKey(key);
      this.setDefaultPreference(preferenceKey, AddonChannelType.Stable);

      const autoUpdateKey = this.getClientDefaultAutoUpdateKey(key);
      this.setDefaultPreference(autoUpdateKey, false);
    });
  }

  private getDefaultReleaseChannel() {
    return this.isBetaBuild ? WowUpReleaseChannelType.Beta : WowUpReleaseChannelType.Stable;
  }

  /**
   * Clean up lost downloads in the download folder
   */
  private async cleanupDownloads() {
    const downloadFiles = this._fileService.listEntries(this.applicationDownloadsFolderPath, "*");

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
    await this._fileService.createDirectory(this.applicationDownloadsFolderPath);
  }

  private setAutoStartup() {
    if (this._electronService.isLinux) {
      var autoLauncher = new autoLaunch({
        name: "WowUp",
        isHidden: this.startMinimized,
      });

      if (this.startWithSystem) {
        autoLauncher.enable();
      } else {
        autoLauncher.disable();
      }
    } else {
      this._electronService.loginItemSettings = {
        openAtLogin: this.startWithSystem,
        openAsHidden: this._electronService.isMac ? this.startMinimized : false,
        args: this._electronService.isWin ? (this.startMinimized ? ["--hidden"] : []) : [],
      };
    }
  }
}
