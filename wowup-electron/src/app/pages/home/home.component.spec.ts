import { TestBed } from "@angular/core/testing";
import { AddonService, ScanUpdate, ScanUpdateType } from "../../services/addons/addon.service";
import { SessionService } from "../../services/session/session.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { ElectronService } from "../../services";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { httpLoaderFactory } from "../../app.module";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { BehaviorSubject, Observable, Subject } from "rxjs";
import { HomeComponent } from "./home.component";
import { MatLegacySnackBar as MatSnackBar } from "@angular/material/legacy-snack-bar";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { AddonScanError, AddonSyncError } from "../../errors";
import { WarcraftInstallationService } from "../../services/warcraft/warcraft-installation.service";
import { DialogFactory } from "../../services/dialog/dialog.factory";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { GalleryModule } from "ng-gallery";
import { LightboxModule } from "ng-gallery/lightbox";
import { MatModule } from "../../modules/mat-module";

describe("HomeComponent", () => {
  let electronService: ElectronService;
  let wowUpService: WowUpService;
  let sessionService: SessionService;
  let addonService: AddonService;
  let warcraftInstallationService: WarcraftInstallationService;
  let dialogFactory: DialogFactory;

  beforeEach(async () => {
    dialogFactory = jasmine.createSpyObj("DialogFactory", [""], {});

    warcraftInstallationService = jasmine.createSpyObj("WarcraftInstallationService", [""], {
      wowInstallations$: new BehaviorSubject<any[]>([]),
    });

    addonService = jasmine.createSpyObj("AddonService", [""], {
      scanUpdate$: new BehaviorSubject<ScanUpdate>({ type: ScanUpdateType.Unknown }).asObservable(),
      syncError$: new Subject<AddonSyncError>(),
      scanError$: new Subject<AddonScanError>(),
      addonInstalled$: new Subject<AddonUpdateEvent>(),
    });

    electronService = jasmine.createSpyObj("ElectronService", [""], {
      isWin: false,
      isLinux: true,
      isMax: false,
      powerMonitor$: new Observable(),
      customProtocol$: new Observable(),
    });

    wowUpService = jasmine.createSpyObj("WowUpService", {
      checkForAppUpdate: () => Promise.resolve(undefined),
    });

    sessionService = jasmine.createSpyObj("SessionService", [""], {});

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
        GalleryModule,
        LightboxModule,
      ],
      providers: [MatSnackBar],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
      .overrideComponent(HomeComponent, {
        set: {
          providers: [
            { provide: ElectronService, useValue: electronService },
            { provide: SessionService, useValue: sessionService },
            { provide: AddonService, useValue: addonService },
            { provide: WowUpService, useValue: wowUpService },
            { provide: DialogFactory, useValue: dialogFactory },
            { provide: WarcraftInstallationService, useValue: warcraftInstallationService },
          ],
        },
      })
      .compileComponents();
  });

  it("should create", () => {
    const fixture = TestBed.createComponent(HomeComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
