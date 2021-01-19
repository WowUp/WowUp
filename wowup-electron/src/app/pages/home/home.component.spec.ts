import { ComponentFixture, TestBed } from "@angular/core/testing";
import { AddonService, ScanUpdate, ScanUpdateType } from "../../services/addons/addon.service";
import { SessionService } from "../../services/session/session.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { ElectronService } from "../../services";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { httpLoaderFactory } from "../../app.module";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { BehaviorSubject, Observable, Subject } from "rxjs";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { HomeComponent } from "./home.component";
import { MatSnackBar } from "@angular/material/snack-bar";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { MatModule } from "../../mat-module";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { AddonScanError, AddonSyncError } from "../../errors";

describe("HomeComponent", () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let electronService: ElectronService;
  let electronServiceSpy: any;
  let wowUpService: WowUpService;
  let wowUpServiceSpy: any;
  let sessionService: SessionService;
  let sessionServiceSpy: any;
  let addonService: AddonService;
  let addonServiceSpy: AddonService;
  let warcraftService: WarcraftService;
  let warcraftServiceSpy: any;

  beforeEach(async () => {
    addonServiceSpy = jasmine.createSpyObj("AddonService", [""], {
      scanUpdate$: new BehaviorSubject<ScanUpdate>({ type: ScanUpdateType.Unknown }).asObservable(),
      syncError$: new Subject<AddonSyncError>(),
      scanError$: new Subject<AddonScanError>(),
    });
    warcraftServiceSpy = jasmine.createSpyObj("WarcraftService", [""], {
      installedClientTypes$: new BehaviorSubject<WowClientType[] | undefined>(undefined).asObservable(),
    });
    electronServiceSpy = jasmine.createSpyObj("ElectronService", [""], {
      isWin: false,
      isLinux: true,
      isMax: false,
      powerMonitor$: new Observable(),
    });
    wowUpServiceSpy = jasmine.createSpyObj("WowUpService", {
      checkForAppUpdate: async () => null,
    });

    await TestBed.configureTestingModule({
      declarations: [HomeComponent],
      imports: [
        MatModule,
        HttpClientModule,
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
        }),
      ],
      providers: [MatSnackBar],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
      .overrideComponent(HomeComponent, {
        set: {
          providers: [
            { provide: AddonService, useValue: addonServiceSpy },
            { provide: WowUpService, useValue: wowUpServiceSpy },
            { provide: ElectronService, useValue: electronServiceSpy },
            { provide: SessionService, useValue: sessionServiceSpy },
            { provide: WarcraftService, useValue: warcraftServiceSpy },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    addonService = fixture.debugElement.injector.get(AddonService);
    wowUpService = fixture.debugElement.injector.get(WowUpService);
    electronService = fixture.debugElement.injector.get(ElectronService);
    sessionService = fixture.debugElement.injector.get(SessionService);
    warcraftService = fixture.debugElement.injector.get(WarcraftService);

    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.debugElement.nativeElement.remove();
    fixture.destroy();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
