import { remote } from "electron";
import { UpdateCheckResult } from "electron-updater";
import * as _ from "lodash";
import { join } from "path";
import { Subject } from "rxjs";

import { Injectable } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

import {
  ADDON_MIGRATION_VERSION_KEY,
  ADDON_PROVIDERS_KEY,
  ALLIANCE_LIGHT_THEME,
  ALLIANCE_THEME,
  APP_UPDATE_CHECK_END,
  APP_UPDATE_CHECK_FOR_UPDATE,
  APP_UPDATE_CHECK_START,
  APP_UPDATE_DOWNLOADED,
  APP_UPDATE_INSTALL,
  APP_UPDATE_START_DOWNLOAD,
  COLLAPSE_TO_TRAY_PREFERENCE_KEY,
  CURRENT_THEME_KEY,
  DEFAULT_AUTO_UPDATE_PREFERENCE_KEY_SUFFIX,
  DEFAULT_CHANNEL_PREFERENCE_KEY_SUFFIX,
  DEFAULT_LIGHT_THEME,
  DEFAULT_THEME,
  ENABLE_SYSTEM_NOTIFICATIONS_PREFERENCE_KEY,
  GET_ADDONS_HIDDEN_COLUMNS_KEY,
  GET_ADDONS_SORT_ORDER,
  HORDE_LIGHT_THEME,
  HORDE_THEME,
  IPC_GET_APP_VERSION,
  PROTOCOL_REGISTERED_PREFERENCE_KEY,
  LAST_SELECTED_WOW_CLIENT_TYPE_PREFERENCE_KEY,
  MY_ADDONS_HIDDEN_COLUMNS_KEY,
  MY_ADDONS_SORT_ORDER,
  SELECTED_LANGUAGE_PREFERENCE_KEY,
  START_MINIMIZED_PREFERENCE_KEY,
  START_WITH_SYSTEM_PREFERENCE_KEY,
  USE_HARDWARE_ACCELERATION_PREFERENCE_KEY,
  USE_SYMLINK_MODE_PREFERENCE_KEY,
  WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY,
} from "../../../common/constants";
import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { AddonChannelType } from "../../../common/wowup/models";
import { AddonProviderState } from "../../models/wowup/addon-provider-state";
import { ColumnState } from "../../models/wowup/column-state";
import { PreferenceChange } from "../../models/wowup/preference-change";
import { SortOrder } from "../../models/wowup/sort-order";
import { WowUpReleaseChannelType } from "../../models/wowup/wowup-release-channel-type";
import { getEnumList, getEnumName } from "../../utils/enum.utils";
import { ElectronService } from "../electron/electron.service";
import { FileService } from "../files/file.service";
import { PreferenceStorageService } from "../storage/preference-storage.service";

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

  public readonly preferenceChange$ = this._preferenceChangeSrc.asObservable();
  public readonly wowupUpdateDownloaded$ = this._wowupUpdateDownloadedSrc.asObservable();
  public readonly wowupUpdateDownloadInProgress$ = this._wowupUpdateDownloadInProgressSrc.asObservable();
  public readonly wowupUpdateCheck$ = this._wowupUpdateCheckSrc.asObservable();
  public readonly wowupUpdateCheckInProgress$ = this._wowupUpdateCheckInProgressSrc.asObservable();

  public constructor(
    private _preferenceStorageService: PreferenceStorageService,
    private _electronService: ElectronService,
    private _fileService: FileService,
    private _translateService: TranslateService
  ) {
    this.setDefaultPreferences()
      // .then(() => console.debug("Set default preferences"))
      .catch((e) => console.error("Failed to set default preferences", e));

    this.createDownloadDirectory()
      .then(() => this.cleanupDownloads())
      // .then(() => console.debug("createDownloadDirectory complete"))
      .catch((e) => console.error("Failed to create download directory", e));

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

    this.setAutoStartup()
      .then(() => console.log("loginItemSettings", this._electronService.getLoginItemSettings()))
      .catch((e) => console.error(e));
  }

  public async getApplicationVersion(): Promise<string> {
    const appVersion = await this._electronService.invoke<string>(IPC_GET_APP_VERSION);
    return `${appVersion}${this._electronService.isPortable ? " (portable)" : ""}`;
  }

  public async isBetaBuild(): Promise<boolean> {
    const appVersion = await this.getApplicationVersion();
    return appVersion.toLowerCase().indexOf("beta") != -1;
  }

  /**
   * This is called before the app component is initialized in order to catch issues
   * with unsupported languages
   */
  public async initializeLanguage(): Promise<void> {
    console.log("Language setup start");
    const langCode = this.currentLanguage || (await this._electronService.getLocale());

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

  public get availableVersion(): string {
    return this._availableVersion;
  }

  public get collapseToTray(): boolean {
    const preference = this._preferenceStorageService.findByKey(COLLAPSE_TO_TRAY_PREFERENCE_KEY);
    return preference === "true";
  }

  public set collapseToTray(value: boolean) {
    const key = COLLAPSE_TO_TRAY_PREFERENCE_KEY;
    this._preferenceStorageService.set(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });
  }

  public get currentTheme(): string {
    return this._preferenceStorageService.get(CURRENT_THEME_KEY) || DEFAULT_THEME;
  }

  public set currentTheme(value: string) {
    const key = CURRENT_THEME_KEY;
    this._preferenceStorageService.set(key, value);
    this._preferenceChangeSrc.next({ key, value: value });
  }

  public get useHardwareAcceleration(): boolean {
    const preference = this._preferenceStorageService.findByKey(USE_HARDWARE_ACCELERATION_PREFERENCE_KEY);
    return preference === "true";
  }

  public set useHardwareAcceleration(value: boolean) {
    const key = USE_HARDWARE_ACCELERATION_PREFERENCE_KEY;
    this._preferenceStorageService.set(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });
  }

  public get useSymlinkMode(): boolean {
    const preference = this._preferenceStorageService.findByKey(USE_SYMLINK_MODE_PREFERENCE_KEY);
    return preference === "true";
  }

  public set useSymlinkMode(value: boolean) {
    const key = USE_SYMLINK_MODE_PREFERENCE_KEY;
    this._preferenceStorageService.set(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });
  }

  public get currentLanguage(): string {
    const preference = this._preferenceStorageService.findByKey(SELECTED_LANGUAGE_PREFERENCE_KEY);
    console.log("Set Language Preference: " + preference);
    return preference;
  }

  public set currentLanguage(value: string) {
    const key = SELECTED_LANGUAGE_PREFERENCE_KEY;
    this._preferenceStorageService.set(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });
  }

  public getStartWithSystem(): boolean {
    const preference = this._preferenceStorageService.findByKey(START_WITH_SYSTEM_PREFERENCE_KEY);
    return preference === "true";
  }

  public async setStartWithSystem(value: boolean): Promise<void> {
    const key = START_WITH_SYSTEM_PREFERENCE_KEY;
    this._preferenceStorageService.set(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });

    await this.setAutoStartup();
  }

  public get startMinimized(): boolean {
    const preference = this._preferenceStorageService.findByKey(START_MINIMIZED_PREFERENCE_KEY);
    return preference === "true";
  }

  public async setStartMinimized(value: boolean): Promise<void> {
    const key = START_MINIMIZED_PREFERENCE_KEY;
    this._preferenceStorageService.set(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });

    await this.setAutoStartup();
  }

  public get wowUpReleaseChannel(): WowUpReleaseChannelType {
    const preference = this._preferenceStorageService.findByKey(WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY);
    return parseInt(preference, 10) as WowUpReleaseChannelType;
  }

  public set wowUpReleaseChannel(releaseChannel: WowUpReleaseChannelType) {
    this._preferenceStorageService.set(WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY, releaseChannel);
  }

  public getAddonProviderStates(): AddonProviderState[] {
    return this._preferenceStorageService.getObject<AddonProviderState[]>(ADDON_PROVIDERS_KEY) || [];
  }

  public getAddonProviderState(providerName: string): AddonProviderState {
    const preference = this.getAddonProviderStates();
    return _.find(preference, (pref) => pref.providerName === providerName.toLowerCase());
  }

  public setAddonProviderState(state: AddonProviderState): void {
    const key = ADDON_PROVIDERS_KEY;
    const stateCpy = { ...state };
    stateCpy.providerName = stateCpy.providerName.toLowerCase();

    const preference = this.getAddonProviderStates();
    const stateIndex = _.findIndex(preference, (pref) => pref.providerName === stateCpy.providerName);

    if (stateIndex === -1) {
      preference.push(stateCpy);
    } else {
      preference[stateIndex] = stateCpy;
    }

    this._preferenceStorageService.setObject(key, preference);
    this._preferenceChangeSrc.next({ key, value: preference.toString() });
  }

  public getLastSelectedClientType(): WowClientType {
    const preference = this._preferenceStorageService.findByKey(LAST_SELECTED_WOW_CLIENT_TYPE_PREFERENCE_KEY);
    const value = parseInt(preference, 10);
    return isNaN(value) ? WowClientType.None : (value as WowClientType);
  }

  public setLastSelectedClientType(clientType: WowClientType): void {
    this._preferenceStorageService.set(LAST_SELECTED_WOW_CLIENT_TYPE_PREFERENCE_KEY, clientType);
  }

  public get enableSystemNotifications(): boolean {
    return this._preferenceStorageService.findByKey(ENABLE_SYSTEM_NOTIFICATIONS_PREFERENCE_KEY) === true.toString();
  }

  public set enableSystemNotifications(enabled: boolean) {
    this._preferenceStorageService.set(ENABLE_SYSTEM_NOTIFICATIONS_PREFERENCE_KEY, enabled);
  }

  public getMyAddonsHiddenColumns(): ColumnState[] {
    return this._preferenceStorageService.getObject<ColumnState[]>(MY_ADDONS_HIDDEN_COLUMNS_KEY) || [];
  }

  public setMyAddonsHiddenColumns(columnStates: ColumnState[]): void {
    this._preferenceStorageService.setObject(MY_ADDONS_HIDDEN_COLUMNS_KEY, columnStates);
  }

  public getMyAddonsSortOrder(): SortOrder[] {
    return this._preferenceStorageService.getObject<SortOrder[]>(MY_ADDONS_SORT_ORDER);
  }

  public setMyAddonsSortOrder(sortOrder: SortOrder[]): void {
    this._preferenceStorageService.setObject(MY_ADDONS_SORT_ORDER, sortOrder);
  }

  public getGetAddonsHiddenColumns(): ColumnState[] {
    return this._preferenceStorageService.getObject<ColumnState[]>(GET_ADDONS_HIDDEN_COLUMNS_KEY) || [];
  }

  public setGetAddonsHiddenColumns(columnStates: ColumnState[]): void {
    this._preferenceStorageService.setObject(GET_ADDONS_HIDDEN_COLUMNS_KEY, columnStates);
  }

  public get getAddonsSortOrder(): SortOrder {
    return this._preferenceStorageService.getObject<SortOrder>(GET_ADDONS_SORT_ORDER);
  }

  public set getAddonsSortOrder(sortOrder: SortOrder) {
    this._preferenceStorageService.setObject(GET_ADDONS_SORT_ORDER, sortOrder);
  }

  public getClientDefaultAddonChannelKey(clientType: WowClientType): string {
    const typeName = getEnumName(WowClientType, clientType);
    return `${typeName}${DEFAULT_CHANNEL_PREFERENCE_KEY_SUFFIX}`.toLowerCase();
  }

  public async shouldMigrateAddons(): Promise<boolean> {
    const migrateVersion = this._preferenceStorageService.get(ADDON_MIGRATION_VERSION_KEY);
    return migrateVersion !== (await this._electronService.getVersionNumber());
  }

  public async setMigrationVersion(): Promise<void> {
    const versionNumber = await this._electronService.getVersionNumber();
    this._preferenceStorageService.set(ADDON_MIGRATION_VERSION_KEY, versionNumber);
  }

  public async showLogsFolder(): Promise<void> {
    await this._fileService.showDirectory(this.applicationLogsFolderPath);
  }

  public async checkForAppUpdate(): Promise<UpdateCheckResult> {
    const updateCheckResult: UpdateCheckResult = await this._electronService.invoke(APP_UPDATE_CHECK_FOR_UPDATE);

    // only notify things when the version changes
    const isSameVersion = await this.isSameVersion(updateCheckResult);
    if (!isSameVersion) {
      this._availableVersion = updateCheckResult.updateInfo.version;
      this._wowupUpdateCheckSrc.next(updateCheckResult);
    }

    return updateCheckResult;
  }

  public async isSameVersion(updateCheckResult: UpdateCheckResult): Promise<boolean> {
    const appVersion = await this._electronService.getVersionNumber();
    return updateCheckResult && updateCheckResult.updateInfo?.version === appVersion;
  }

  public async downloadUpdate(): Promise<any> {
    const downloadResult = await this._electronService.invoke(APP_UPDATE_START_DOWNLOAD);

    this._wowupUpdateDownloadedSrc.next(downloadResult);
    return downloadResult;
  }

  public async installUpdate(): Promise<any> {
    return await this._electronService.invoke(APP_UPDATE_INSTALL);
  }

  public getThemeLogoPath(): string {
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
    const pref = this._preferenceStorageService.findByKey(key);
    if (pref === null || pref === undefined) {
      this._preferenceStorageService.set(key, defaultValue.toString());
    }
  }

  private getClientDefaultAutoUpdateKey(clientType: WowClientType): string {
    const typeName = getEnumName(WowClientType, clientType);
    return `${typeName}${DEFAULT_AUTO_UPDATE_PREFERENCE_KEY_SUFFIX}`.toLowerCase();
  }

  private async setDefaultPreferences() {
    this.setDefaultPreference(ENABLE_SYSTEM_NOTIFICATIONS_PREFERENCE_KEY, true);
    this.setDefaultPreference(COLLAPSE_TO_TRAY_PREFERENCE_KEY, true);
    this.setDefaultPreference(USE_HARDWARE_ACCELERATION_PREFERENCE_KEY, true);
    this.setDefaultPreference(CURRENT_THEME_KEY, DEFAULT_THEME);
    this.setDefaultPreference(WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY, await this.getDefaultReleaseChannel());
    this.setDefaultPreference(USE_SYMLINK_MODE_PREFERENCE_KEY, false);
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

  private async getDefaultReleaseChannel() {
    const isBetaBuild = await this.isBetaBuild();
    return isBetaBuild ? WowUpReleaseChannelType.Beta : WowUpReleaseChannelType.Stable;
  }

  /**
   * Clean up lost downloads in the download folder
   */
  private async cleanupDownloads() {
    const downloadFiles = await this._fileService.listEntries(this.applicationDownloadsFolderPath, "*");

    for (const entry of downloadFiles) {
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

  private async setAutoStartup(): Promise<void> {
    if (this._electronService.isLinux) {
      const autoLauncher = new window.libs.autoLaunch({
        name: "WowUp",
        isHidden: this.startMinimized,
      });

      if (this.getStartWithSystem()) {
        autoLauncher.enable();
      } else {
        autoLauncher.disable();
      }
    } else {
      await this._electronService.setLoginItemSettings({
        openAtLogin: this.getStartWithSystem(),
        openAsHidden: this._electronService.isMac ? this.startMinimized : false,
        args: this._electronService.isWin ? (this.startMinimized ? ["--hidden"] : []) : [],
      });
    }
  }
}
