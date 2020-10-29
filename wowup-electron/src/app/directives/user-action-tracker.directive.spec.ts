import { inject } from "@angular/core/testing";
import { AnalyticsService } from "../services/analytics/analytics.service";
import { UserActionTrackerDirective } from "./user-action-tracker.directive";

describe("UserActionTrackerDirective", () => {
  it("should create an instance", () => {
    inject([AnalyticsService], (analyticsService: AnalyticsService) => {
      const instance = new UserActionTrackerDirective(analyticsService);
      expect(instance).toBeTruthy();
    });
  });
});
