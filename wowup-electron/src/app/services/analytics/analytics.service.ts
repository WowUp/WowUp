import { Injectable } from "@angular/core";
import { ApplicationInsights } from "@microsoft/applicationinsights-web";
import { BehaviorSubject } from "rxjs";
import { v4 as uuidV4 } from "uuid";
import { AppConfig } from "../../../environments/environment";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { TELEMETRY_ENABLED_KEY } from "../../../common/constants";
import { ElectronService } from "..";
import { WowUpService } from "../wowup/wowup.service";

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

  public async shouldPromptTelemetry(): Promise<boolean> {
    return (await this._preferenceStorageService.getAsync(TELEMETRY_ENABLED_KEY)) === undefined;
  }

  public async getTelemetryEnabled(): Promise<boolean> {
    const enabled = await this._preferenceStorageService.getBool(TELEMETRY_ENABLED_KEY);
    this.configureAppInsights(enabled);
    return enabled;
  }

  public async setTelemetryEnabled(value: boolean) {
    if (this._insights) {
      this._insights.appInsights.config.disableTelemetry = value;
    }

    await this._preferenceStorageService.setAsync(TELEMETRY_ENABLED_KEY, value);
    this._telemetryEnabledSrc.next(value);
  }

  public constructor(
    private _preferenceStorageService: PreferenceStorageService,
    private _electronService: ElectronService,
    private _wowUpService: WowUpService
  ) {
    this._installId = this.loadInstallId();

    this.getTelemetryEnabled()
      .then((enabled) => {
        this._telemetryEnabledSrc.next(enabled);
      })
      .catch(console.error);
  }

  public async trackStartup(): Promise<void> {
    const systemLocale = await this._electronService.getLocale();
    const uiLocale = await this._wowUpService.getCurrentLanguage();
    this.track("app-startup", {
      systemLocale,
      uiLocale,
    });
  }

  public trackError(error: Error): void {
    if (!this._telemetryEnabledSrc.value) {
      return;
    }

    this._insights?.trackException({ exception: error });
  }

  private track(name: string, properties = undefined) {
    if (!this._telemetryEnabledSrc.value) {
      return;
    }

    this._insights?.trackEvent({ name, properties });
  }

  public trackAction(name: string, properties: any = undefined): void {
    this.track(name, properties);
  }

  private loadInstallId() {
    let installId = this._preferenceStorageService.getSync(this.installIdPreferenceKey);
    if (installId) {
      return installId;
    }

    installId = uuidV4();
    this._preferenceStorageService.setAsync(this.installIdPreferenceKey, installId).catch(console.error);

    return installId;
  }

  private configureAppInsights(enable: boolean) {
    if (!enable || this._insights) {
      return;
    }

    this._insights = new ApplicationInsights({
      config: {
        instrumentationKey: AppConfig.azure.applicationInsightsKey,
        disableAjaxTracking: true,
        disableFetchTracking: true,
      },
    });
    this._insights.loadAppInsights();
    this._insights.trackPageView();

    // If telemetry is off, don't let it track anything
    this._insights.addTelemetryInitializer(() => {
      if (!this._telemetryEnabledSrc.value) {
        return false;
      }
    });
  }
}
