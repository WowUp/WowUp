import { Overlay } from "@angular/cdk/overlay";
import { ChangeDetectorRef, NgZone } from "@angular/core";
import { inject } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";
import { ElectronService } from "../../services";
import { AddonService } from "../../services/addons/addon.service";
import { SessionService } from "../../services/session/session.service";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { MyAddonsComponent } from "./my-addons.component";
import { WowUpAddonService } from "../../services/wowup/wowup-addon.service";
import { WowUpService } from "../../services/wowup/wowup.service";

describe("MyAddonsComponent", () => {
  it("should create", () => {
    inject(
      [
        AddonService,
        SessionService,
        NgZone,
        MatDialog,
        ChangeDetectorRef,
        TranslateService,
        WowUpAddonService,
        ElectronService,
        Overlay,
        WarcraftService,
        WowUpService,
      ],
      (
        addonService: AddonService,
        sessionService: SessionService,
        ngZone: NgZone,
        dialog: MatDialog,
        cdRef: ChangeDetectorRef,
        wowUpAddonService: WowUpAddonService,
        translateService: TranslateService,
        electronService: ElectronService,
        overlay: Overlay,
        warcraftService: WarcraftService,
        wowUpService: WowUpService,
      ) => {
        const instance = new MyAddonsComponent(
          addonService,
          sessionService,
          ngZone,
          dialog,
          cdRef,
          wowUpAddonService,
          translateService,
          electronService,
          overlay,
          warcraftService,
          wowUpService,
        );
        expect(instance).toBeTruthy();
      }
    );
  });
});
