import { ErrorHandler } from "@angular/core";
import { AnalyticsService } from "../services/analytics/analytics.service";

export class ErrorHandlerInterceptor implements ErrorHandler {
  public constructor(private _analytics: AnalyticsService) {}

  // ErrorHandler
  public handleError(error: Error): void {
    console.error("Caught error", error);

    this._analytics.trackError(((error as any).innerError as Error) ?? error);
  }
}
