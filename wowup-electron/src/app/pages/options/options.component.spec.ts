import { NgZone } from "@angular/core";
import { inject } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";
import { AddonService } from "../../services/addons/addon.service";
import { AnalyticsService } from "../../services/analytics/analytics.service";
import { ElectronService } from "../../services/electron/electron.service";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { OptionsComponent } from "./options.component";

describe("OptionsComponent", () => {
  it("should create", () => {
    inject(
      [
        AddonService,
        AnalyticsService,
        WarcraftService,
        WowUpService,
        MatDialog,
        NgZone,
        ElectronService,
        TranslateService,
      ],
      (
        addonService: AddonService,
        analyticsService: AnalyticsService,
        warcraft: WarcraftService,
        wowupService: WowUpService,
        dialog: MatDialog,
        zone: NgZone,
        electronService: ElectronService,
        translateService: TranslateService
      ) => {
        const instance = new OptionsComponent(
          addonService,
          analyticsService,
          warcraft,
          wowupService,
          dialog,
          zone,
          electronService,
          translateService
        );
        expect(instance).toBeTruthy();
      }
    );
  });
});
