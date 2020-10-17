import { ErrorHandler, Injectable } from "@angular/core";
import * as Rollbar from "rollbar";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { telemetryEnabledKey } from "../../../constants";
import { AppConfig } from "environments/environment";
import { HttpClient, HttpParams } from "@angular/common/http";

@Injectable({
  providedIn: "root",
})
export class AnalyticsService implements ErrorHandler {
  private readonly analyticsUrl = "https://www.google-analytics.com";
  private readonly installIdPreferenceKey = "install_id";
  private readonly telemetryPromptUsedKey = "telemetry_prompt_sent";
  private readonly telemetryEnabledKey = "telemetry_enabled";

  private readonly rollbarConfig = {
    accessToken: AppConfig.rollbarAccessKey,
    captureUncaught: true,
    captureUnhandledRejections: true,
  };

  private _rollbar: Rollbar;
  private get rollbar() {
    if (!this.telemetryEnabled) {
      return undefined;
    }

    if (!this._rollbar) {
      this._rollbar = new Rollbar(this.rollbarConfig);
    }
    return this._rollbar;
  }

  private get telemetryEnabled() {
    return (
      this._preferenceStorageService.get(telemetryEnabledKey) ===
      true.toString()
    );
  }

  public get shouldPromptTelemetry() {
    return (
      this._preferenceStorageService.get(telemetryEnabledKey) === undefined
    );
  }

  constructor(
    private _preferenceStorageService: PreferenceStorageService,
    private _httpClient: HttpClient
  ) {}

  public async TrackStartup() {
    await Track((request) => {
      request.SetQueryParam("t", "pageview").SetQueryParam("dp", "app/startup");
    });

    await TrackAppCenter("AppStartup");
  }

  // ErrorHandler
  handleError(error: any): void {
    console.error("Caught error", error);

    this.rollbar?.error(error.originalError || error);
  }

  private async track(action: (params: HttpParams) => void = undefined) {
    if (!this.telemetryEnabled) {
      return;
    }

    var url = `${this.analyticsUrl}/collect`;

    try {
      let params = new HttpParams();
      params.set('v', '1');
      params.set('tid', AppConfig.googleAnalyticsId);
      params.set('cid', AppConfig.googleAnalyticsId);

      action?.call(params);

      const response = await this._httpClient
        .post(
          url,
          {},
          {
            params,
          }
        )
        .toPromise();
      var response = await request
        .SetQueryParam("v", "1")
        .SetQueryParam("tid", "")
        .SetQueryParam("cid", InstallId)
        .SetQueryParam("ua", HttpUtilities.UserAgent)
        .SetQueryParam("an", "WowUp Client")
        .SetQueryParam("av", AppUtilities.CurrentVersionString)
        .PostJsonAsync(new {}());
    } catch (Exception) {
      // eat
    }
  }
}
