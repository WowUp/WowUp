import { Injectable } from "@angular/core";
import { ApplicationInsights } from "@microsoft/applicationinsights-web";
import { BehaviorSubject } from "rxjs";
import { v4 as uuidV4 } from "uuid";
import { AppConfig } from "../../../environments/environment";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { TELEMETRY_ENABLED_KEY } from "../../../common/constants";

@Injectable({
  providedIn: "root",
})
export class AnalyticsService {
  private readonly installIdPreferenceKey = "install_id";
  private readonly _installId: string;
  private readonly _telemetryEnabledSrc = new BehaviorSubject(false);

  private _insights?: ApplicationInsights;

  public readonly telemetryEnabled$ = this._telemetryEnabledSrc.asObservable();

  private get installId() {
    return this._installId;
  }

  public get shouldPromptTelemetry() {
    return this._preferenceStorageService.get(TELEMETRY_ENABLED_KEY) === undefined;
  }

  public get telemetryEnabled() {
    const preference = this._preferenceStorageService.findByKey(TELEMETRY_ENABLED_KEY);
    const value = preference === true.toString();

    this.configureAppInsights(value);

    return value;
  }

  public set telemetryEnabled(value: boolean) {
    console.log(`Set telemetry enabled: ${value}`);

    if (this._insights) {
      this._insights.appInsights.config.disableTelemetry = value;
    }

    this._preferenceStorageService.set(TELEMETRY_ENABLED_KEY, value);
    this._telemetryEnabledSrc.next(value);
  }

  constructor(private _preferenceStorageService: PreferenceStorageService) {
    this._installId = this.loadInstallId();
    this._telemetryEnabledSrc.next(this.telemetryEnabled);
    console.log("installId", this._installId);
  }

  public trackStartup() {
    this.track("app-startup");
  }

  public trackError(error: Error) {
    if (!this.telemetryEnabled) {
      return;
    }

    this._insights?.trackException({ exception: error });
  }

  private track(name: string, properties: object = undefined) {
    if (!this.telemetryEnabled) {
      return;
    }

    this._insights?.trackEvent({ name, properties });
  }

  public trackAction(name: string, properties: object = undefined) {
    this.track(name, properties);
  }

  private loadInstallId() {
    let installId = this._preferenceStorageService.findByKey(this.installIdPreferenceKey);
    if (installId) {
      return installId;
    }

    installId = uuidV4();
    this._preferenceStorageService.set(this.installIdPreferenceKey, installId);

    return installId;
  }

  private configureAppInsights(enable: boolean) {
    if (!enable || this._insights) {
      return;
    }

    this._insights = new ApplicationInsights({
      config: {
        instrumentationKey: AppConfig.azure.applicationInsightsKey,
      },
    });
    this._insights.loadAppInsights();
    this._insights.trackPageView();

    // If telemetry is off, don't let it track anything
    this._insights.addTelemetryInitializer((envelop) => {
      if (!this.telemetryEnabled) {
        return false;
      }
    });
  }
}
