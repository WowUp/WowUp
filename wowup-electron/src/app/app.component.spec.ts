import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { AppComponent } from "./app.component";
import { ElectronService } from "./services";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { httpLoaderFactory } from "./app.module";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { AddonService } from "./services/addons/addon.service";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { WowUpService } from "./services/wowup/wowup.service";
import { SessionService } from "./services/session/session.service";
import { FileService } from "./services/files/file.service";
import { AnalyticsService } from "./services/analytics/analytics.service";
import { IconService } from "./services/icons/icon.service";
import { OverlayContainer, OverlayModule } from "@angular/cdk/overlay";
import { Subject } from "rxjs";
import { PreferenceChange } from "./models/wowup/preference-change";

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

  beforeEach(async () => {
    addonServiceSpy = jasmine.createSpyObj("AddonService", ["processAutoUpdates"]);
    electronServiceSpy = jasmine.createSpyObj("ElectronService", ["invoke"], {
      appOptions: {quit : null},
    });
    wowUpServiceSpy = jasmine.createSpyObj("WowUpService", [""], {
      preferenceChange$: new Subject<PreferenceChange>().asObservable(),
    });
    sessionServiceSpy = jasmine.createSpyObj("SessionService", [""]);
    fileServiceSpy = jasmine.createSpyObj("FileService", [""]);
    analyticsServiceSpy = jasmine.createSpyObj("AnalyticsService", ["trackStartup"]);

    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      providers: [
        MatDialog,
        ElectronService,
      ],
      imports: [
        OverlayModule,
        RouterTestingModule,
        HttpClientModule,
        MatDialogModule,
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
        })
      ],
    }).overrideComponent(AppComponent, {
      set: {
        providers: [
          MatDialog,
          IconService,
          OverlayContainer,
          { provide: AddonService, useValue: addonServiceSpy },
          { provide: ElectronService, useValue: electronServiceSpy },
          { provide: WowUpService, useValue: wowUpServiceSpy },
          { provide: SessionService, useValue: sessionServiceSpy },
          { provide: FileService, useValue: fileServiceSpy },
          { provide: AnalyticsService, useValue: analyticsServiceSpy },
        ]},
    }).compileComponents();

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
