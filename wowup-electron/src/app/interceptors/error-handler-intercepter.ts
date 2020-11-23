import { ErrorHandler } from "@angular/core";
import { AnalyticsService } from "../services/analytics/analytics.service";

export class ErrorHandlerIntercepter implements ErrorHandler {
  constructor(private _analytics: AnalyticsService) {}

  // ErrorHandler
  handleError(error: any): void {
    console.error("Caught error", error);

    this._analytics.trackError(error.originalError || error);
  }
}
