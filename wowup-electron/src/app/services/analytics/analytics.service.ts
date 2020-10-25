import { Injectable } from "@angular/core";
import { v4 as uuidv4 } from "uuid";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { AppConfig } from "environments/environment";
import { HttpClient, HttpParams } from "@angular/common/http";
import { ElectronService } from "../electron/electron.service";
import { BehaviorSubject } from "rxjs";
import * as firebase from "firebase/app";
import "firebase/analytics";

@Injectable({
  providedIn: "root",
})
export class AnalyticsService {
  private readonly analyticsUrl = "https://www.google-analytics.com";
  private readonly installIdPreferenceKey = "install_id";
  private readonly _installId: string;
  private readonly _appVersion: string;
  private readonly _telemetryEnabledSrc = new BehaviorSubject(false);

  private _firebaseApp?: firebase.app.App;
  private _firebaseAnalytics?: firebase.analytics.Analytics;

  public readonly telemetryPromptUsedKey = "telemetry_prompt_sent";
  public readonly telemetryEnabledKey = "telemetry_enabled";
  public readonly telemetryEnabled$ = this._telemetryEnabledSrc.asObservable();

  private get installId() {
    return this._installId;
  }

  private startFirebase() {
    if (this._firebaseApp) {
      return;
    }

    this._firebaseApp = firebase.initializeApp(AppConfig.firebaseConfig);
    this._firebaseAnalytics = firebase.analytics(this._firebaseApp);
    this._firebaseAnalytics.setUserId(this.installId);
  }

  private setFirebaseAnalyticsEnabled(enabled: boolean) {
    this._firebaseAnalytics?.setAnalyticsCollectionEnabled(enabled);
  }

  public get shouldPromptTelemetry() {
    return (
      this._preferenceStorageService.get(this.telemetryEnabledKey) === undefined
    );
  }

  public get telemetryEnabled() {
    const preference = this._preferenceStorageService.findByKey(
      this.telemetryEnabledKey
    );
    const isEnabled = preference === true.toString();

    this.setFirebaseAnalyticsEnabled(isEnabled);
    if (isEnabled) {
      this.startFirebase();
    }

    return isEnabled;
  }

  public set telemetryEnabled(value: boolean) {
    this._preferenceStorageService.set(this.telemetryEnabledKey, value);
    this._telemetryEnabledSrc.next(value);
  }

  constructor(
    private _electronService: ElectronService,
    private _preferenceStorageService: PreferenceStorageService
  ) {
    this._appVersion = this._electronService.remote.app.getVersion();
    this._installId = this.loadInstallId();
    this._telemetryEnabledSrc.next(this.telemetryEnabled);
  }

  public trackStartup() {
    if (!this.telemetryEnabled) {
      return;
    }

    this._firebaseAnalytics.logEvent("app_startup");
  }

  public trackUserAction(
    category: string,
    action: string,
    label: string = null
  ) {
    this.trackEvent(category, {
      [action]: label,
    });
  }

  private trackEvent(eventName: string, params: { [key: string]: any }) {
    if (!this.telemetryEnabled) {
      return;
    }

    this._firebaseAnalytics.logEvent(eventName, params);
  }

  // private async track(action: (params: HttpParams) => void = undefined) {
  //   if (!this.telemetryEnabled) {
  //     return;
  //   }

  //   var url = `${this.analyticsUrl}/collect`;

  //   try {
  //     let params = new URLSearchParams();
  //     params.set("v", "1");
  //     params.set("tid", AppConfig.googleAnalyticsId);
  //     params.set("cid", this._installId);
  //     params.set("ua", window.navigator.userAgent);
  //     params.set("an", "WowUp Client");
  //     params.set("av", this._appVersion);

  //     action?.call(this, params);

  //     const fullUrl = `${url}?${params}`;

  //     const response = await this._httpClient
  //       .post(
  //         fullUrl,
  //         {},
  //         {
  //           responseType: "text",
  //         }
  //       )
  //       .toPromise();
  //   } catch (e) {
  //     // eat
  //     console.error(e);
  //   }
  // }

  private loadInstallId() {
    let installId = this._preferenceStorageService.findByKey(
      this.installIdPreferenceKey
    );
    if (installId) {
      return installId;
    }

    installId = uuidv4();
    this._preferenceStorageService.set(this.installIdPreferenceKey, installId);

    return installId;
  }
}
