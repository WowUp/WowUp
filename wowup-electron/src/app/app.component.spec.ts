import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { Observable, Subject } from "rxjs";

import { OverlayContainer, OverlayModule } from "@angular/cdk/overlay";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { RouterTestingModule } from "@angular/router/testing";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";

import { AppComponent } from "./app.component";
import { httpLoaderFactory } from "./app.module";
import { MatModule } from "./mat-module";
import { PreferenceChange } from "./models/wowup/preference-change";
import { ElectronService } from "./services";
import { AddonService } from "./services/addons/addon.service";
import { AnalyticsService } from "./services/analytics/analytics.service";
import { FileService } from "./services/files/file.service";
import { SessionService } from "./services/session/session.service";
import { PreferenceStorageService } from "./services/storage/preference-storage.service";
import { WowUpService } from "./services/wowup/wowup.service";
import { WowUpAddonService } from "./services/wowup/wowup-addon.service";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { AnimatedLogoComponent } from "./components/animated-logo/animated-logo.component";

describe("AppComponent", () => {
  let addonServiceSpy: AddonService;
  let electronServiceSpy: ElectronService;
  let wowUpServiceSpy: WowUpService;
  let sessionServiceSpy: SessionService;
  let fileServiceSpy: FileService;
  let analyticsServiceSpy: AnalyticsService;
  let preferenceStorageSpy: PreferenceStorageService;
  let wowUpAddonServiceSpy: WowUpAddonService;

  beforeEach(async () => {
    wowUpAddonServiceSpy = jasmine.createSpyObj(
      "WowUpAddonService",
      ["updateForClientType", "updateForAllClientTypes"],
      {
        persistUpdateInformationToWowUpAddon: () => {},
      }
    );
    addonServiceSpy = jasmine.createSpyObj("AddonService", ["processAutoUpdates", "syncAllClients"], {
      syncError$: new Subject(),
    });
    electronServiceSpy = jasmine.createSpyObj("ElectronService", ["invoke", "on", "off"], {
      appOptions: { quit: null },
      getAppOptions: () => Promise.resolve({}),
      powerMonitor$: new Observable(),
      ipcRenderer: {
        on: () => {},
      },
    });
    wowUpServiceSpy = jasmine.createSpyObj("WowUpService", [""], {
      preferenceChange$: new Subject<PreferenceChange>().asObservable(),
    });
    sessionServiceSpy = jasmine.createSpyObj("SessionService", ["autoUpdateComplete"]);
    fileServiceSpy = jasmine.createSpyObj("FileService", [""]);
    analyticsServiceSpy = jasmine.createSpyObj("AnalyticsService", ["trackStartup"]);
    preferenceStorageSpy = jasmine.createSpyObj("PreferenceStorageService", ["get"], {});

    await TestBed.configureTestingModule({
      declarations: [AppComponent, AnimatedLogoComponent],
      providers: [MatDialog, ElectronService],
      imports: [
        OverlayModule,
        RouterTestingModule,
        HttpClientModule,
        MatModule,
        NoopAnimationsModule,
        TranslateModule.forRoot({
          loader: {
            provide: TranslateLoader,
            useFactory: httpLoaderFactory,
            deps: [HttpClient],
          },
          compiler: {
            provide: TranslateCompiler,
            useClass: TranslateMessageFormatCompiler,
          },
        }),
      ],
    })
      .overrideComponent(AppComponent, {
        set: {
          providers: [
            MatDialog,
            OverlayContainer,
            { provide: AddonService, useValue: addonServiceSpy },
            { provide: ElectronService, useValue: electronServiceSpy },
            { provide: WowUpService, useValue: wowUpServiceSpy },
            { provide: SessionService, useValue: sessionServiceSpy },
            { provide: FileService, useValue: fileServiceSpy },
            { provide: AnalyticsService, useValue: analyticsServiceSpy },
            { provide: PreferenceStorageService, useValue: preferenceStorageSpy },
            { provide: WowUpAddonService, useValue: wowUpAddonServiceSpy },
          ],
        },
      })
      .compileComponents();
  });

  it("should create", () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
