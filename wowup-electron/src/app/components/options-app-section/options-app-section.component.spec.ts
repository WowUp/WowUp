import { ComponentFixture, TestBed } from "@angular/core/testing";
import { TranslateCompiler, TranslateLoader, TranslateModule, TranslateService } from "@ngx-translate/core";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { AnalyticsService } from "../../services/analytics/analytics.service";
import { FileService } from "../../services/files/file.service";
import { SessionService } from "../../services/session/session.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { ElectronService } from "../../services";
import { OptionsAppSectionComponent } from "./options-app-section.component";
import { httpLoaderFactory } from "../../app.module";
import { BehaviorSubject } from "rxjs";
import { MatSelectModule } from "@angular/material/select";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

describe("OptionsAppSectionComponent", () => {
  let component: OptionsAppSectionComponent;
  let fixture: ComponentFixture<OptionsAppSectionComponent>;
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
    analyticsServiceSpy = jasmine.createSpyObj("AnalyticsService", [""], {
      telemetryEnabled$: new BehaviorSubject(false).asObservable()
    });
    electronServiceSpy = jasmine.createSpyObj("ElectronService", [""], {
      isWin : false,
      isLinux : true,
      isMac: false,
    });
    wowUpServiceSpy = jasmine.createSpyObj("WowUpService", [""], {
      collapseToTray: false,
      useHardwareAcceleration: false,
      startWithSystem: false,
      startMinimized: false,
      currentLanguage: false,
    });

    await TestBed.configureTestingModule({
      declarations: [OptionsAppSectionComponent],
      providers: [
        MatDialog,
        ElectronService,
      ],
      imports: [
        MatSelectModule,
        HttpClientModule,
        MatDialogModule,
        BrowserAnimationsModule,
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
    }).overrideComponent(OptionsAppSectionComponent, {
      set: {
        providers: [
          MatDialog,
          { provide: ElectronService, useValue: electronServiceSpy },
          { provide: WowUpService, useValue: wowUpServiceSpy },
          { provide: SessionService, useValue: sessionServiceSpy },
          { provide: FileService, useValue: fileServiceSpy },
          { provide: AnalyticsService, useValue: analyticsServiceSpy },
        ]},
    }).compileComponents();

    fixture = TestBed.createComponent(OptionsAppSectionComponent);
    component = fixture.componentInstance;
    electronService = fixture.debugElement.injector.get(ElectronService);
    sessionService = fixture.debugElement.injector.get(SessionService);
    wowUpService = fixture.debugElement.injector.get(WowUpService);
    fileService = fixture.debugElement.injector.get(FileService);
    analyticsService = fixture.debugElement.injector.get(AnalyticsService);

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
