import { ErrorHandler } from "@angular/core";
import { AnalyticsService } from "app/services/analytics/analytics.service";
import { AppConfig } from "environments/environment";
import * as Rollbar from "rollbar";

export class ErrorHandlerIntercepter implements ErrorHandler {
  private readonly rollbarConfig = {
    accessToken: AppConfig.rollbarAccessKey,
    captureUncaught: true,
    captureUnhandledRejections: true,
  };

  private _rollbar: Rollbar;
  private get rollbar() {
    if (!this._analytics.telemetryEnabled) {
      return undefined;
    }

    if (!this._rollbar) {
      this._rollbar = new Rollbar(this.rollbarConfig);
    }
    return this._rollbar;
  }

  constructor(private _analytics: AnalyticsService) {}

  // ErrorHandler
  handleError(error: any): void {
    console.error("Caught error", error);

    this.rollbar?.error(error.originalError || error);
  }
}
