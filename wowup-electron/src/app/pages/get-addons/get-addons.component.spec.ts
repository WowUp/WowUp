import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { BehaviorSubject, Subject } from "rxjs";

import { OverlayModule } from "@angular/cdk/overlay";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";

import { httpLoaderFactory } from "../../app.module";
import { ElectronService } from "../../services";
import { AddonService } from "../../services/addons/addon.service";
import { SessionService } from "../../services/session/session.service";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { GetAddonsComponent } from "./get-addons.component";
import { SnackbarService } from "../../services/snackbar/snackbar.service";
import { WarcraftInstallationService } from "../../services/warcraft/warcraft-installation.service";
import { DownloadCountPipe } from "../../pipes/download-count.pipe";
import { RelativeDurationPipe } from "../../pipes/relative-duration-pipe";
import { MatModule } from "../../modules/mat-module";
import { PipesModule } from "../../modules/pipes.module";
import { AddonProviderFactory } from "../../services/addons/addon.provider.factory";
import { AddonChannelType, WowClientType } from "wowup-lib-core";
import { WowInstallation } from "wowup-lib-core";

describe("GetAddonsComponent", () => {
  let component: GetAddonsComponent;
  let fixture: ComponentFixture<GetAddonsComponent>;
  let electronServiceSpy: any;
  let wowUpServiceSpy: any;
  let sessionServiceSpy: any;
  let addonServiceSpy: any;
  let warcraftServiceSpy: any;
  let snackbarService: SnackbarService;
  let warcraftInstallationService: WarcraftInstallationService;
  let addonProviderService: any;

  beforeEach(async () => {
    wowUpServiceSpy = jasmine.createSpyObj("WowUpService", [""], {
      getGetAddonsHiddenColumns: () => Promise.resolve([]),
    });
    sessionServiceSpy = jasmine.createSpyObj(
      "SessionService",
      {
        getSelectedWowInstallation: () => {
          const inst: WowInstallation = {
            defaultAddonChannelType: AddonChannelType.Stable,
            id: "test",
            clientType: WowClientType.Retail,
            location: "C:/fake_wow",
            label: "Wow Unit Test Client",
            displayName: "Wow Unit Test Client",
            defaultAutoUpdate: false,
            selected: true,
          };
          return inst;
        },
      },
      {
        selectedHomeTab$: new BehaviorSubject(0).asObservable(),
      }
    );
    warcraftServiceSpy = jasmine.createSpyObj("WarcraftService", [""], {
      installedClientTypesSelectItems$: new BehaviorSubject<WowClientType[] | undefined>(undefined).asObservable(),
    });
    electronServiceSpy = jasmine.createSpyObj("ElectronService", [""], {
      isWin: false,
      isLinux: true,
      isMac: false,
    });
    addonServiceSpy = jasmine.createSpyObj("AddonService", [""], {
      searchError$: new Subject<Error>(),
    });

    snackbarService = jasmine.createSpyObj("SnackbarService", [""], {});
    addonProviderService = jasmine.createSpyObj("AddonProviderFactory", [""], {});

    warcraftInstallationService = jasmine.createSpyObj("WarcraftInstallationService", [""], {
      wowInstallations$: new BehaviorSubject<any[]>([]),
    });

    const testBed = TestBed.configureTestingModule({
      declarations: [GetAddonsComponent],
      imports: [
        MatModule,
        OverlayModule,
        BrowserAnimationsModule,
        HttpClientModule,
        PipesModule,
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
      providers: [MatDialog, RelativeDurationPipe, DownloadCountPipe],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).overrideComponent(GetAddonsComponent, {
      set: {
        providers: [
          { provide: AddonService, useValue: addonServiceSpy },
          { provide: SessionService, useValue: sessionServiceSpy },
          { provide: WowUpService, useValue: wowUpServiceSpy },
          { provide: SnackbarService, useValue: snackbarService },
          { provide: ElectronService, useValue: electronServiceSpy },
          { provide: WarcraftService, useValue: warcraftServiceSpy },
          { provide: WarcraftInstallationService, useValue: warcraftInstallationService },
          { provide: AddonProviderFactory, useValue: addonProviderService },
        ],
      },
    });

    await testBed.compileComponents();

    fixture = TestBed.createComponent(GetAddonsComponent);
    component = fixture.componentInstance;

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
