import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { CachingService } from "../caching/caching-service";
import { remote } from "electron";
import { join } from 'path';
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { version } from '../../../../package.json';
import { WowUpReleaseChannelType } from "app/models/wowup/wowup-release-channel-type";
import { getEnumKeys, getEnumList, getEnumName } from "app/utils/enum.utils";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { AddonChannelType } from "app/models/wowup/addon-channel-type";
import { ElectronService } from "../electron/electron.service";

const COLLAPSE_TO_TRAY_PREFERENCE_KEY = 'collapse_to_tray';
const WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY = 'wowup_release_channel';
const DEFAULT_CHANNEL_PREFERENCE_KEY_SUFFIX = '_default_addon_channel';
const TELEMETRY_ENABLED_PREFERENCE_KEY = 'telemetry_enabled';
const TELEMETRY_PROMPT_SENT_PREFERENCE_KEY = 'telemetry_prompt_sent';

@Injectable({
  providedIn: 'root'
})
export class WowUpService {

  public readonly updaterName = 'WowUpUpdater.exe';
  public readonly applicationFolderPath: string = remote.app.getPath('userData');
  public readonly applicationLogsFolderPath: string = join(this.applicationFolderPath, 'logs');
  public readonly applicationDownloadsFolderPath: string = join(this.applicationFolderPath, 'downloads');
  public readonly applicationUpdaterPath: string = join(this.applicationFolderPath, this.updaterName);
  public readonly applicationVersion: string = version;
  public readonly isBetaBuild: boolean = version.toLowerCase().indexOf('beta') != -1;

  constructor(
    private _preferenceStorageService: PreferenceStorageService,
    private _electronService: ElectronService,
    private cache: CachingService,
    private http: HttpClient
  ) {
    this.setDefaultPreferences();
  }

  public get collapseToTray() {
    const preference = this._preferenceStorageService.findByKey(COLLAPSE_TO_TRAY_PREFERENCE_KEY);
    return preference === 'true';
  }

  public set collapseToTray(value: boolean) {
    this._preferenceStorageService.set(COLLAPSE_TO_TRAY_PREFERENCE_KEY, value.toString());
  }

  public get telemetryEnabled() {
    const preference = this._preferenceStorageService.findByKey(TELEMETRY_ENABLED_PREFERENCE_KEY);
    return preference === 'true';
  }

  public set telemetryEnabled(value: boolean) {
    this._preferenceStorageService.set(TELEMETRY_ENABLED_PREFERENCE_KEY, value.toString());
  }

  public showLogsFolder() {
    this._electronService.shell.openExternal(this.applicationLogsFolderPath, { activate: true });
  }

  public setCollapseToTray(enabled: boolean) {
    this._preferenceStorageService.set(COLLAPSE_TO_TRAY_PREFERENCE_KEY, enabled.toString())
  }

  private setDefaultPreference(key: string, defaultValue: any) {
    let pref = this._preferenceStorageService.findByKey(key);
    if (!pref) {
      this._preferenceStorageService.set(key, defaultValue.toString());
    }
  }

  private getClientDefaultAddonChannelKey(clientType: WowClientType) {
    const typeName = getEnumName(WowClientType, clientType);
    return `${typeName}${DEFAULT_CHANNEL_PREFERENCE_KEY_SUFFIX}`.toLowerCase();
  }

  private setDefaultPreferences() {
    this.setDefaultPreference(COLLAPSE_TO_TRAY_PREFERENCE_KEY, true);
    this.setDefaultPreference(WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY, this.getDefaultReleaseChannel());
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