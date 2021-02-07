import { HttpClientModule } from "@angular/common/http";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { MatModule } from "../../mat-module";
import { AddonService } from "../../services/addons/addon.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { createTranslateModule } from "../../utils/test.utils";

import { OptionsAddonSectionComponent } from "./options-addon-section.component";

describe("OptionsAddonSectionComponent", () => {
  let component: OptionsAddonSectionComponent;
  let fixture: ComponentFixture<OptionsAddonSectionComponent>;
  let wowUpServiceSpy: any;
  let addonServiceSpy: any;

  beforeEach(async () => {
    addonServiceSpy = jasmine.createSpyObj("AddonService", [""], {
      getAddonProviderStates: () => [],
    });

    wowUpServiceSpy = jasmine.createSpyObj("WowUpService", [""], {
      collapseToTray: false,
      useHardwareAcceleration: false,
      startWithSystem: false,
      startMinimized: false,
      currentLanguage: false,
    });

    await TestBed.configureTestingModule({
      declarations: [OptionsAddonSectionComponent],
      imports: [HttpClientModule, MatModule, NoopAnimationsModule, createTranslateModule()],
    })
      .overrideComponent(OptionsAddonSectionComponent, {
        set: {
          providers: [
            { provide: AddonService, useValue: addonServiceSpy },
            { provide: WowUpService, useValue: wowUpServiceSpy },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(OptionsAddonSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
