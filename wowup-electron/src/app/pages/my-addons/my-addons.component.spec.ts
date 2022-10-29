import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { BehaviorSubject, Subject } from "rxjs";

import { OverlayModule } from "@angular/cdk/overlay";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { CUSTOM_ELEMENTS_SCHEMA, ElementRef } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";

import { httpLoaderFactory } from "../../app.module";
import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { SortOrder } from "../../models/wowup/sort-order";
import { ElectronService } from "../../services";
import { AddonService } from "../../services/addons/addon.service";
import { SessionService } from "../../services/session/session.service";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { WowUpAddonService } from "../../services/wowup/wowup-addon.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { MyAddonsComponent } from "./my-addons.component";
import { WarcraftInstallationService } from "../../services/warcraft/warcraft-installation.service";
import { RelativeDurationPipe } from "../../pipes/relative-duration-pipe";
import { PushService } from "../../services/push/push.service";
import { InvertBoolPipe } from "../../pipes/inverse-bool.pipe";
import { MatModule } from "../../modules/mat-module";
import { AddonUiService } from "../../services/addons/addon-ui.service";
import { AddonProviderFactory } from "../../services/addons/addon.provider.factory";

export class MockElementRef extends ElementRef {
  public constructor() {
    super(null);
  }
}

export function mockElementFactory(): ElementRef {
  return new ElementRef({ nativeElement: jasmine.createSpyObj("nativeElement", ["value"]) });
}

describe("MyAddonsComponent", () => {
  let component: MyAddonsComponent;
  let fixture: ComponentFixture<MyAddonsComponent>;
  let electronServiceSpy: any;
  let wowUpServiceSpy: any;
  let wowUpAddonServiceSpy: any;
  let sessionServiceSpy: any;
  let addonServiceSpy: any;
  let warcraftServiceSpy: any;
  let warcraftInstallationService: WarcraftInstallationService;
  let pushService: PushService;
  let addonUiService: AddonUiService;
  let addonProviderService: any;

  beforeEach(async () => {
    addonUiService = jasmine.createSpyObj("AddonUiService", [""], {});
    addonProviderService = jasmine.createSpyObj("AddonProviderFactory", [""], {});

    wowUpAddonServiceSpy = jasmine.createSpyObj("WowUpAddonService", ["updateForClientType"], {
      persistUpdateInformationToWowUpAddon: () => {},
    });
    addonServiceSpy = jasmine.createSpyObj(
      "AddonService",
      {
        getAddons: Promise.resolve([]),
        backfillAddons: Promise.resolve(undefined),
      },
      {
        addonInstalled$: new Subject<AddonUpdateEvent>().asObservable(),
        addonRemoved$: new Subject<string>().asObservable(),
      }
    );

    pushService = jasmine.createSpyObj("PushService", [""], {
      addonUpdate$: new Subject<any>(),
    });

    const testSortOrder: SortOrder = {
      colId: "name",
      sort: "asc",
    };
    wowUpServiceSpy = jasmine.createSpyObj("WowUpService", [""], {
      myAddonsSortOrder: testSortOrder,
      getMyAddonsHiddenColumns: () => Promise.resolve([]),
    });
    sessionServiceSpy = jasmine.createSpyObj("SessionService", ["getSelectedHomeTab"], {
      selectedHomeTab$: new BehaviorSubject(0).asObservable(),
      autoUpdateComplete$: new BehaviorSubject(0).asObservable(),
      selectedClientType$: new BehaviorSubject(WowClientType.Retail).asObservable(),
      targetFileInstallComplete$: new Subject<boolean>(),
      addonsChanged$: new BehaviorSubject([]),
      selectedWowInstallation$: new BehaviorSubject({}),
      rescanComplete$: new BehaviorSubject(0).asObservable(),
    });
    warcraftServiceSpy = jasmine.createSpyObj("WarcraftService", [""], {
      installedClientTypesSelectItems$: new BehaviorSubject<WowClientType[] | undefined>(undefined).asObservable(),
    });
    electronServiceSpy = jasmine.createSpyObj("ElectronService", [""], {
      isWin: false,
      isLinux: true,
      isMac: false,
    });

    warcraftInstallationService = jasmine.createSpyObj("WarcraftInstallationService", [""], {
      wowInstallations$: new BehaviorSubject<any[]>([]),
    });

    const testBed = TestBed.configureTestingModule({
      declarations: [MyAddonsComponent, InvertBoolPipe],
      imports: [
        MatModule,
        OverlayModule,
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
      providers: [MatDialog, RelativeDurationPipe],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).overrideComponent(MyAddonsComponent, {
      set: {
        providers: [
          { provide: AddonService, useValue: addonServiceSpy },
          { provide: WowUpService, useValue: wowUpServiceSpy },
          { provide: WowUpAddonService, useValue: wowUpAddonServiceSpy },
          { provide: ElectronService, useValue: electronServiceSpy },
          { provide: SessionService, useValue: sessionServiceSpy },
          { provide: WarcraftService, useValue: warcraftServiceSpy },
          { provide: WarcraftInstallationService, useValue: warcraftInstallationService },
          { provide: PushService, useValue: pushService },
          { provide: AddonUiService, useValue: addonUiService },
          { provide: AddonProviderFactory, useValue: addonProviderService },
        ],
      },
    });

    await testBed.compileComponents();

    fixture = TestBed.createComponent(MyAddonsComponent);
    component = fixture.componentInstance;

    component.addonFilter = {
      nativeElement: jasmine.createSpyObj("nativeElement", ["value"]),
    };
    console.debug("addonFilter", component.addonFilter);

    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.debugElement.nativeElement.remove();
    fixture.destroy();
  });

  it("should create", () => {
    console.debug("addonFilter", component.addonFilter);
    expect(component).toBeTruthy();
  });
});
