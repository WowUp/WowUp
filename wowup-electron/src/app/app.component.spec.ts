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

describe("AppComponent", () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let addonService: AddonService;
  let addonServiceSpy: any;
  let electronService: ElectronService;
  let electronServiceSpy: any;
  let wowUpService: WowUpService;
  let wowUpServiceSpy: any;
  let sessionService: SessionService;
  let sessionServiceSpy: any;
  let fileService: FileService;
  let fileServiceSpy: any;
  let analyticsService: AnalyticsService;
  let analyticsServiceSpy: any;
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
    addonServiceSpy = jasmine.createSpyObj("AddonService", ["processAutoUpdates"]);
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
      declarations: [AppComponent],
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

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    addonService = fixture.debugElement.injector.get(AddonService);
    electronService = fixture.debugElement.injector.get(ElectronService);
    wowUpService = fixture.debugElement.injector.get(WowUpService);
    sessionService = fixture.debugElement.injector.get(SessionService);
    fileService = fixture.debugElement.injector.get(FileService);
    analyticsService = fixture.debugElement.injector.get(AnalyticsService);

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
