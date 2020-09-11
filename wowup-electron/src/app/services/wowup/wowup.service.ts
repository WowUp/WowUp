import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { CachingService } from "../caching/caching-service";
import { remote } from "electron";
import { join } from 'path';
import { PreferenceStorageService } from "../storage/preference-storage.service";

const COLLAPSE_TO_TRAY_PREFERENCE_KEY = 'collapse_to_tray';

@Injectable({
  providedIn: 'root'
})
export class WowUpService {

  public static readonly updaterName = 'WowUpUpdater.exe';
  public static readonly applicationFolderPath: string = remote.app.getPath('userData');
  public static readonly applicationLogsFolderPath: string = join(WowUpService.applicationFolderPath, 'logs');
  public static readonly applicationDownloadsFolderPath: string = join(WowUpService.applicationFolderPath, 'downloads');
  public static readonly applicationUpdaterPath: string = join(WowUpService.applicationFolderPath, WowUpService.updaterName);

  constructor(
    private _preferenceStorageService: PreferenceStorageService,
    private cache: CachingService,
    private http: HttpClient
  ) {
    this.setDefaultPreferences();
  }


  private setDefaultPreferences(){
    this._preferenceStorageService.findByKey(COLLAPSE_TO_TRAY_PREFERENCE_KEY);
  }

}