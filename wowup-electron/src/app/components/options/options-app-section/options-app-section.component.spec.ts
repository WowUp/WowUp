import { BehaviorSubject } from "rxjs";

import { HttpClientModule } from "@angular/common/http";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormsModule } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

import { ElectronService } from "../../../services";
import { AddonService } from "../../../services/addons/addon.service";
import { AnalyticsService } from "../../../services/analytics/analytics.service";
import { FileService } from "../../../services/files/file.service";
import { SessionService } from "../../../services/session/session.service";
import { WowUpService } from "../../../services/wowup/wowup.service";
import { ZoomService } from "../../../services/zoom/zoom.service";
import { createTranslateModule } from "../../../utils/test.utils";
import { OptionsAppSectionComponent } from "./options-app-section.component";
import { MatModule } from "../../../modules/mat-module";

describe("OptionsAppSectionComponent", () => {
  let component: OptionsAppSectionComponent;
  let fixture: ComponentFixture<OptionsAppSectionComponent>;
  let electronServiceSpy: any;
  let wowUpServiceSpy: any;
  let sessionServiceSpy: any;
  let fileServiceSpy: any;
  let analyticsServiceSpy: any;
  let addonService: any;
  let zoomService: ZoomService;

  beforeEach(async () => {
    addonService = jasmine.createSpyObj("AddonService", [""], {});

    sessionServiceSpy = jasmine.createSpyObj("SessionService", [""], {});

    analyticsServiceSpy = jasmine.createSpyObj("AnalyticsService", [""], {
      telemetryEnabled$: new BehaviorSubject(false).asObservable(),
      getTelemetryEnabled: () => Promise.resolve(false),
    });

    zoomService = jasmine.createSpyObj("ZoomService", [""], {
      zoomFactor$: new BehaviorSubject(1.0).asObservable(),
      getZoomFactor: Promise.resolve(1.0),
    });

    electronServiceSpy = jasmine.createSpyObj(
      "ElectronService",
      {
        onRendererEvent: () => undefined,
        isDefaultProtocolClient: Promise.resolve(false),
      },
      {
        isWin: false,
        isLinux: true,
        isMac: false,
      }
    );

    wowUpServiceSpy = jasmine.createSpyObj("WowUpService", ["getStartWithSystem"], {
      collapseToTray: false,
      useHardwareAcceleration: false,
      startWithSystem: false,
      startMinimized: false,
      currentLanguage: false,
      setCurrentTheme: () => Promise.resolve(),
      getCollapseToTray: () => Promise.resolve(false),
      getEnableSystemNotifications: () => Promise.resolve(false),
      getCurrentLanguage: () => Promise.resolve("en"),
      getUseSymlinkMode: () => Promise.resolve(false),
      getUseHardwareAcceleration: () => Promise.resolve(false),
      getEnableAppBadge: () => Promise.resolve(false),
      getWowUpReleaseChannel: () => Promise.resolve(false),
      getStartWithSystem: () => Promise.resolve(false),
      getStartMinimized: () => Promise.resolve(false),
      getKeepLastAddonDetailTab: () => Promise.resolve(false),
    });

    await TestBed.configureTestingModule({
      declarations: [OptionsAppSectionComponent],
      providers: [MatDialog, ElectronService],
      imports: [HttpClientModule, FormsModule, MatModule, BrowserAnimationsModule, createTranslateModule()],
    })
      .overrideComponent(OptionsAppSectionComponent, {
        set: {
          providers: [
            MatDialog,
            { provide: ElectronService, useValue: electronServiceSpy },
            { provide: WowUpService, useValue: wowUpServiceSpy },
            { provide: SessionService, useValue: sessionServiceSpy },
            { provide: FileService, useValue: fileServiceSpy },
            { provide: AnalyticsService, useValue: analyticsServiceSpy },
            { provide: ZoomService, useValue: zoomService },
            { provide: AddonService, useValue: addonService },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(OptionsAppSectionComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
