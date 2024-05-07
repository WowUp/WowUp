import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { BehaviorSubject, Observable, Subject } from "rxjs";

import { OverlayContainer, OverlayModule } from "@angular/cdk/overlay";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { RouterTestingModule } from "@angular/router/testing";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";

import { AppComponent } from "./app.component";
import { httpLoaderFactory } from "./app.module";
import { AnimatedLogoComponent } from "./components/common/animated-logo/animated-logo.component";
import { MatModule } from "./modules/mat-module";
import { PreferenceChange } from "./models/wowup/preference-change";
import { ElectronService } from "./services";
import { AddonService } from "./services/addons/addon.service";
import { AnalyticsService } from "./services/analytics/analytics.service";
import { FileService } from "./services/files/file.service";
import { SessionService } from "./services/session/session.service";
import { PreferenceStorageService } from "./services/storage/preference-storage.service";
import { WarcraftInstallationService } from "./services/warcraft/warcraft-installation.service";
import { WowUpAddonService } from "./services/wowup/wowup-addon.service";
import { WowUpService } from "./services/wowup/wowup.service";
import { ZoomService } from "./services/zoom/zoom.service";
import { AddonProviderFactory } from "./services/addons/addon.provider.factory";
import { mockPreload } from "./tests/test-helpers";

describe("AppComponent", () => {
  let addonServiceSpy: AddonService;
  let electronServiceSpy: ElectronService;
  let wowUpServiceSpy: WowUpService;
  let sessionServiceSpy: SessionService;
  let fileServiceSpy: FileService;
  let analyticsServiceSpy: AnalyticsService;
  let preferenceStorageSpy: PreferenceStorageService;
  let wowUpAddonServiceSpy: WowUpAddonService;
  let warcraftInstallationService: WarcraftInstallationService;
  let zoomService: ZoomService;
  let addonProviderService: any;

  beforeEach(async () => {
    mockPreload();

    wowUpAddonServiceSpy = jasmine.createSpyObj(
      "WowUpAddonService",
      ["updateForClientType", "updateForAllClientTypes"],
      {
        persistUpdateInformationToWowUpAddon: () => {},
      },
    );

    addonServiceSpy = jasmine.createSpyObj("AddonService", ["processAutoUpdates", "syncAllClients"], {
      syncError$: new Subject(),
    });

    addonProviderService = jasmine.createSpyObj(
      "AddonProviderFactory",
      {
        getAdRequiredProviders: () => [],
      },
      {},
    );

    warcraftInstallationService = jasmine.createSpyObj("WarcraftInstallationService", [""], {
      wowInstallations$: new Subject(),
    });

    zoomService = jasmine.createSpyObj("ZoomService", [""], {});

    electronServiceSpy = jasmine.createSpyObj("ElectronService", ["invoke", "on", "off"], {
      appOptions: { quit: null },
      getAppOptions: () => Promise.resolve({}),
      powerMonitor$: new Observable(),
      appUpdate$: new Observable(),
      ipcRenderer: {
        on: () => {},
      },
    });
    wowUpServiceSpy = jasmine.createSpyObj("WowUpService", [""], {
      preferenceChange$: new Subject<PreferenceChange>().asObservable(),
    });
    sessionServiceSpy = jasmine.createSpyObj("SessionService", ["autoUpdateComplete"], {
      adSpace$: new BehaviorSubject(false),
    });
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
            { provide: WarcraftInstallationService, useValue: warcraftInstallationService },
            { provide: ZoomService, useValue: zoomService },
            { provide: AddonProviderFactory, useValue: addonProviderService },
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
