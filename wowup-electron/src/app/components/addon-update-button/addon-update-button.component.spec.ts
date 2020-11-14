import { inject } from "@angular/core/testing";
import { TranslateService } from "@ngx-translate/core";
import { AddonService } from "../../services/addons/addon.service";
import { AnalyticsService } from "../../services/analytics/analytics.service";
import { AddonUpdateButtonComponent } from "./addon-update-button.component";

describe("AddonUpdateButtonComponent", () => {
  it("should create", () => {
    inject(
      [AddonService, AnalyticsService, TranslateService],
      (addonService: AddonService, analyticsService: AnalyticsService, translateService: TranslateService) => {
        const instance = new AddonUpdateButtonComponent(addonService, analyticsService, translateService);
        expect(instance).toBeTruthy();
      }
    );
  });
});
