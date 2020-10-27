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
        ElectronService,
        Overlay,
        WarcraftService,
      ],
      (
        addonService: AddonService,
        sessionService: SessionService,
        ngZone: NgZone,
        dialog: MatDialog,
        cdRef: ChangeDetectorRef,
        translateService: TranslateService,
        electronService: ElectronService,
        overlay: Overlay,
        warcraftService: WarcraftService
      ) => {
        const instance = new MyAddonsComponent(
          addonService,
          sessionService,
          ngZone,
          dialog,
          cdRef,
          translateService,
          electronService,
          overlay,
          warcraftService
        );
        expect(instance).toBeTruthy();
      }
    );
  });
});
