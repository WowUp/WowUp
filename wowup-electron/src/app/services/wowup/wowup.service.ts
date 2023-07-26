import { UpdateCheckResult } from "electron-updater";
import * as _ from "lodash";
import { join } from "path";
import { Subject } from "rxjs";

import { Injectable } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

import {
  ADDON_MIGRATION_VERSION_KEY,
  ADDON_PROVIDERS_KEY,
  COLLAPSE_TO_TRAY_PREFERENCE_KEY,
  CURRENT_THEME_KEY,
  DEFAULT_AUTO_UPDATE_PREFERENCE_KEY_SUFFIX,
  DEFAULT_CHANNEL_PREFERENCE_KEY_SUFFIX,
  DEFAULT_THEME,
  DEFAULT_TRUSTED_DOMAINS,
  ENABLE_APP_BADGE_KEY,
  ENABLE_SYSTEM_NOTIFICATIONS_PREFERENCE_KEY,
  GET_ADDONS_HIDDEN_COLUMNS_KEY,
  GET_ADDONS_SORT_ORDER,
  IPC_APP_CHECK_UPDATE,
  IPC_APP_INSTALL_UPDATE,
  IPC_GET_APP_VERSION,
  IPC_UPDATE_APP_BADGE,
  KEEP_ADDON_DETAIL_TAB_PREFERENCE_KEY,
  MY_ADDONS_HIDDEN_COLUMNS_KEY,
  MY_ADDONS_SORT_ORDER,
  SELECTED_LANGUAGE_PREFERENCE_KEY,
  START_MINIMIZED_PREFERENCE_KEY,
  START_WITH_SYSTEM_PREFERENCE_KEY,
  TRUSTED_DOMAINS_KEY,
  UPDATE_NOTES_POPUP_VERSION_KEY,
  USE_HARDWARE_ACCELERATION_PREFERENCE_KEY,
  USE_SYMLINK_MODE_PREFERENCE_KEY,
  WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY,
} from "../../../common/constants";
import { AddonProviderState } from "../../models/wowup/addon-provider-state";
import { ColumnState } from "../../models/wowup/column-state";
import { PreferenceChange } from "../../models/wowup/preference-change";
import { SortOrder } from "../../models/wowup/sort-order";
import { getEnumName, getEnumList } from "wowup-lib-core/lib/utils";
import { ElectronService } from "../electron/electron.service";
import { FileService } from "../files/file.service";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { WowUpReleaseChannelType } from "../../../common/wowup/wowup-release-channel-type";
import { AddonChannelType, AddonProviderType, WowClientType } from "wowup-lib-core";

@Injectable({
  providedIn: "root",
})
export class WowUpService {
  private readonly _preferenceChangeSrc = new Subject<PreferenceChange>();

  private _availableVersion = "";

  public readonly updaterName = "WowUpUpdater.exe";
  public readonly applicationFolderPath: string = window.userDataPath ?? "";
  public readonly applicationLogsFolderPath: string = window.logPath ?? "";
  public readonly applicationDownloadsFolderPath: string = join(this.applicationFolderPath, "downloads");
  public readonly applicationUpdaterPath: string = join(this.applicationFolderPath, this.updaterName);
  public readonly wtfBackupFolder: string = join(this.applicationFolderPath, "wtf_backups");

  public readonly preferenceChange$ = this._preferenceChangeSrc.asObservable();

  public constructor(
    private _preferenceStorageService: PreferenceStorageService,
    private _electronService: ElectronService,
    private _fileService: FileService,
    private _translateService: TranslateService
  ) {
    this.setDefaultClientPreferences().catch(console.error);

    this.createDownloadDirectory()
      .then(() => this.cleanupDownloads())
      // .then(() => console.debug("createDownloadDirectory complete"))
      .catch((e) => console.error("Failed to create download directory", e));

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
    const currentLang = await this.getCurrentLanguage();
    const langCode = currentLang || (await this._electronService.getLocale());

    this._translateService.setDefaultLang("en");
    try {
      await this._translateService.use(langCode).toPromise();
      console.log(`using locale ${langCode}`);
      await this.setCurrentLanguage(langCode);
    } catch (e) {
      console.warn(`Language ${langCode} not found defaulting to english`);
      await this.setCurrentLanguage("en");
      await this._translateService.use("en").toPromise();
    }

    console.log("Language setup complete");
  }

  public get availableVersion(): string {
    return this._availableVersion;
  }

  public async getCollapseToTray(): Promise<boolean> {
    return (await this._preferenceStorageService.getAsync(COLLAPSE_TO_TRAY_PREFERENCE_KEY)) === "true";
  }

  public async setCollapseToTray(value: boolean): Promise<void> {
    const key = COLLAPSE_TO_TRAY_PREFERENCE_KEY;
    await this._preferenceStorageService.setAsync(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });
  }

  public async getCurrentTheme(): Promise<string> {
    const theme = await this._preferenceStorageService.getAsync(CURRENT_THEME_KEY);
    return theme || DEFAULT_THEME;
  }

  public async setCurrentTheme(value: string): Promise<void> {
    const key = CURRENT_THEME_KEY;
    await this._preferenceStorageService.setAsync(key, value);
    this._preferenceChangeSrc.next({ key, value: value });
  }

  public async getUseHardwareAcceleration(): Promise<boolean> {
    const preference = await this._preferenceStorageService.getAsync(USE_HARDWARE_ACCELERATION_PREFERENCE_KEY);
    return preference === "true";
  }

  public async setUseHardwareAcceleration(value: boolean) {
    const key = USE_HARDWARE_ACCELERATION_PREFERENCE_KEY;
    await this._preferenceStorageService.setAsync(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });
  }

  public async getUseSymlinkMode(): Promise<boolean> {
    const preference = await this._preferenceStorageService.getAsync(USE_SYMLINK_MODE_PREFERENCE_KEY);
    return preference === "true";
  }

  public async setUseSymlinkMode(value: boolean): Promise<void> {
    const key = USE_SYMLINK_MODE_PREFERENCE_KEY;
    await this._preferenceStorageService.setAsync(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });
  }

  public async getCurrentLanguage(): Promise<string> {
    const preference = await this._preferenceStorageService.getAsync(SELECTED_LANGUAGE_PREFERENCE_KEY);
    console.log("Set Language Preference: " + preference);
    return preference;
  }

  public async setCurrentLanguage(value: string): Promise<void> {
    const key = SELECTED_LANGUAGE_PREFERENCE_KEY;
    await this._preferenceStorageService.setAsync(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });
  }

  public async getStartWithSystem(): Promise<boolean> {
    const preference = await this._preferenceStorageService.getAsync(START_WITH_SYSTEM_PREFERENCE_KEY);
    return preference === "true";
  }

  public async setStartWithSystem(value: boolean): Promise<void> {
    const key = START_WITH_SYSTEM_PREFERENCE_KEY;
    await this._preferenceStorageService.setAsync(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });

    await this.setAutoStartup();
  }

  public async getStartMinimized(): Promise<boolean> {
    const preference = await this._preferenceStorageService.getAsync(START_MINIMIZED_PREFERENCE_KEY);
    console.log("getStartMinimized", typeof preference, preference);
    return preference === "true";
  }

  public async setStartMinimized(value: boolean): Promise<void> {
    const key = START_MINIMIZED_PREFERENCE_KEY;
    await this._preferenceStorageService.setAsync(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });

    await this.setAutoStartup();
  }

  public async getWowUpReleaseChannel(): Promise<WowUpReleaseChannelType> {
    const preference = await this._preferenceStorageService.getAsync(WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY);
    return parseInt(preference, 10) as WowUpReleaseChannelType;
  }

  public async setWowUpReleaseChannel(releaseChannel: WowUpReleaseChannelType): Promise<void> {
    try {
      await this._electronService.invoke("set-release-channel", releaseChannel);
      return this._preferenceStorageService.setAsync(WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY, releaseChannel);
    } catch (e) {
      console.error(e);
    }
  }

  public async getKeepLastAddonDetailTab(): Promise<boolean> {
    const preference = await this._preferenceStorageService.getAsync(KEEP_ADDON_DETAIL_TAB_PREFERENCE_KEY);
    return preference === "true";
  }

  public async setKeepLastAddonDetailTab(value: boolean): Promise<void> {
    const key = KEEP_ADDON_DETAIL_TAB_PREFERENCE_KEY;
    await this._preferenceStorageService.setAsync(key, value);
    this._preferenceChangeSrc.next({ key, value: value.toString() });
  }

  public async getAddonProviderStates(): Promise<AddonProviderState[]> {
    const obj = await this._preferenceStorageService.getObjectAsync<AddonProviderState[]>(ADDON_PROVIDERS_KEY);
    return obj || [];
  }

  public async getAddonProviderState(providerName: string): Promise<AddonProviderState | undefined> {
    const preference = await this.getAddonProviderStates();
    return _.find(preference, (pref) => pref.providerName === providerName.toLowerCase());
  }

  public async setAddonProviderState(state: AddonProviderState): Promise<void> {
    const key = ADDON_PROVIDERS_KEY;
    const stateCpy = { ...state };
    stateCpy.providerName = stateCpy.providerName.toLowerCase() as AddonProviderType;

    const preference = await this.getAddonProviderStates();
    const stateIndex = _.findIndex(preference, (pref) => pref.providerName === stateCpy.providerName);

    if (stateIndex === -1) {
      preference.push(stateCpy);
    } else {
      preference[stateIndex] = stateCpy;
    }

    await this._preferenceStorageService.setAsync(key, preference);
    this._preferenceChangeSrc.next({ key, value: preference.toString() });
  }

  public async getEnableSystemNotifications(): Promise<boolean> {
    return await this._preferenceStorageService.getBool(ENABLE_SYSTEM_NOTIFICATIONS_PREFERENCE_KEY);
  }

  public async setEnableSystemNotifications(enabled: boolean): Promise<void> {
    await this._preferenceStorageService.setAsync(ENABLE_SYSTEM_NOTIFICATIONS_PREFERENCE_KEY, enabled);
  }

  public async getEnableAppBadge(): Promise<boolean> {
    return await this._preferenceStorageService.getBool(ENABLE_APP_BADGE_KEY);
  }

  public async setEnableAppBadge(enabled: boolean): Promise<void> {
    await this._preferenceStorageService.setAsync(ENABLE_APP_BADGE_KEY, enabled);
  }

  public async updateAppBadgeCount(count: number): Promise<void> {
    const badgeEnabled = await this.getEnableAppBadge();
    if (count > 0 && !badgeEnabled) {
      console.debug("app badge disabled");
      return;
    }

    console.debug("Update app badge", count);
    await this._electronService.invoke(IPC_UPDATE_APP_BADGE, count);
  }

  public async getMyAddonsHiddenColumns(): Promise<ColumnState[]> {
    const obj = await this._preferenceStorageService.getObjectAsync<ColumnState[]>(MY_ADDONS_HIDDEN_COLUMNS_KEY);
    return obj || [];
  }

  public async setMyAddonsHiddenColumns(columnStates: ColumnState[]): Promise<void> {
    await this._preferenceStorageService.setAsync(MY_ADDONS_HIDDEN_COLUMNS_KEY, columnStates);
  }

  public async getMyAddonsSortOrder(): Promise<SortOrder[]> {
    const obj = await this._preferenceStorageService.getObjectAsync<SortOrder[]>(MY_ADDONS_SORT_ORDER);
    return obj ?? [];
  }

  public async setMyAddonsSortOrder(sortOrder: SortOrder[]): Promise<void> {
    await this._preferenceStorageService.setAsync(MY_ADDONS_SORT_ORDER, sortOrder);
  }

  public async getGetAddonsHiddenColumns(): Promise<ColumnState[]> {
    return (await this._preferenceStorageService.getObjectAsync<ColumnState[]>(GET_ADDONS_HIDDEN_COLUMNS_KEY)) || [];
  }

  public async setGetAddonsHiddenColumns(columnStates: ColumnState[]): Promise<void> {
    await this._preferenceStorageService.setAsync(GET_ADDONS_HIDDEN_COLUMNS_KEY, columnStates);
  }

  public async getAddonsSortOrder(): Promise<SortOrder | undefined> {
    return await this._preferenceStorageService.getObjectAsync<SortOrder>(GET_ADDONS_SORT_ORDER);
  }

  public getClientDefaultAddonChannelKey(clientType: WowClientType): string {
    const typeName = getEnumName(WowClientType, clientType);
    return `${typeName}${DEFAULT_CHANNEL_PREFERENCE_KEY_SUFFIX}`.toLowerCase();
  }

  public async shouldShowNewVersionNotes(): Promise<boolean> {
    const popupVersion = await this._preferenceStorageService.getAsync(UPDATE_NOTES_POPUP_VERSION_KEY);
    return popupVersion !== (await this._electronService.getVersionNumber());
  }

  public async setNewVersionNotes(): Promise<void> {
    const versionNumber = await this._electronService.getVersionNumber();
    await this._preferenceStorageService.setAsync(UPDATE_NOTES_POPUP_VERSION_KEY, versionNumber);
  }

  public async shouldMigrateAddons(): Promise<boolean> {
    const migrateVersion = await this._preferenceStorageService.getAsync(ADDON_MIGRATION_VERSION_KEY);
    return migrateVersion !== (await this._electronService.getVersionNumber());
  }

  public async setMigrationVersion(): Promise<void> {
    const versionNumber = await this._electronService.getVersionNumber();
    await this._preferenceStorageService.setAsync(ADDON_MIGRATION_VERSION_KEY, versionNumber);
  }

  public async showLogsFolder(): Promise<void> {
    await this._fileService.showDirectory(this.applicationLogsFolderPath);
  }

  public async showConfigFolder(): Promise<void> {
    await this._fileService.showDirectory(this.applicationFolderPath);
  }

  public checkForAppUpdate(): void {
    this._electronService.send(IPC_APP_CHECK_UPDATE);
  }

  public async isSameVersion(updateCheckResult: UpdateCheckResult): Promise<boolean> {
    const appVersion = await this._electronService.getVersionNumber();
    return updateCheckResult && updateCheckResult.updateInfo?.version === appVersion;
  }

  public installUpdate(): void {
    return this._electronService.send(IPC_APP_INSTALL_UPDATE);
  }

  public async getTrustedDomains(): Promise<string[]> {
    const trustedDomains = await this._preferenceStorageService.getObjectAsync<string[]>(TRUSTED_DOMAINS_KEY);
    return trustedDomains ?? [];
  }

  public async isTrustedDomain(href: string | URL, domains?: string[]): Promise<boolean> {
    const url = href instanceof URL ? href : new URL(href);
    if (DEFAULT_TRUSTED_DOMAINS.includes(url.hostname)) {
      return true;
    }

    const trustedDomains = domains || (await this.getTrustedDomains());
    return trustedDomains.includes(url.hostname);
  }

  public async trustDomain(domain: string): Promise<void> {
    let trustedDomains = await this._preferenceStorageService.getObjectAsync<string[]>(TRUSTED_DOMAINS_KEY);
    trustedDomains = _.uniq([...trustedDomains, domain]);

    await this._preferenceStorageService.setAsync(TRUSTED_DOMAINS_KEY, trustedDomains);
  }

  private async setDefaultPreference(key: string, defaultValue: any): Promise<void> {
    const pref = await this._preferenceStorageService.getAsync(key);
    if (pref === null || pref === undefined) {
      if (Array.isArray(defaultValue)) {
        await this._preferenceStorageService.setAsync(key, defaultValue);
      } else {
        await this._preferenceStorageService.setAsync(key, defaultValue.toString());
      }
    }
  }

  private getClientDefaultAutoUpdateKey(clientType: WowClientType): string {
    const typeName = getEnumName(WowClientType, clientType);
    return `${typeName}${DEFAULT_AUTO_UPDATE_PREFERENCE_KEY_SUFFIX}`.toLowerCase();
  }

  private async setDefaultClientPreferences(): Promise<void> {
    const keys = getEnumList<WowClientType>(WowClientType).filter((key) => key !== WowClientType.None);
    for (const key of keys) {
      const preferenceKey = this.getClientDefaultAddonChannelKey(key);
      await this.setDefaultPreference(preferenceKey, AddonChannelType.Stable);

      const autoUpdateKey = this.getClientDefaultAutoUpdateKey(key);
      await this.setDefaultPreference(autoUpdateKey, false);
    }
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
    const startMinimized = await this.getStartMinimized();
    const startWithSystem = await this.getStartWithSystem();

    if (this._electronService.isLinux) {
      const autoLauncher = new window.libs.autoLaunch({
        name: "WowUp",
        isHidden: startMinimized,
      });

      if (startWithSystem) {
        autoLauncher.enable();
      } else {
        autoLauncher.disable();
      }
    } else {
      await this._electronService.setLoginItemSettings({
        openAtLogin: startWithSystem,
        openAsHidden: this._electronService.isMac ? startMinimized : false,
        args: this._electronService.isWin ? (startMinimized ? ["--hidden"] : []) : [],
      });
    }
  }
}
