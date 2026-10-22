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
import { AddonInstallState } from "../../models/wowup/addon-install-state";
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
import { Addon, WowClientType } from "wowup-lib-core";
import { AddonViewModel } from "../../business-objects/addon-view-model";

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
  let addonInstalledSrc: Subject<AddonUpdateEvent>;

  beforeEach(async () => {
    addonUiService = jasmine.createSpyObj("AddonUiService", [""], {});
    addonProviderService = jasmine.createSpyObj("AddonProviderFactory", [""], {});

    wowUpAddonServiceSpy = jasmine.createSpyObj("WowUpAddonService", ["updateForClientType"], {
      persistUpdateInformationToWowUpAddon: () => {},
    });
    addonInstalledSrc = new Subject<AddonUpdateEvent>();
    addonServiceSpy = jasmine.createSpyObj(
      "AddonService",
      {
        getAddons: Promise.resolve([]),
        backfillAddons: Promise.resolve(undefined),
      },
      {
        addonInstalled$: addonInstalledSrc.asObservable(),
        addonRemoved$: new Subject<string>().asObservable(),
        syncing$: new BehaviorSubject(false).asObservable(),
        anyUpdatesAvailable$: new BehaviorSubject(false).asObservable(),
      },
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
    sessionServiceSpy = jasmine.createSpyObj(
      "SessionService",
      ["getSelectedHomeTab", "setContextText", "getSelectedWowInstallation"],
      {
        selectedHomeTab$: new BehaviorSubject(0).asObservable(),
        autoUpdateComplete$: new BehaviorSubject(0).asObservable(),
        selectedClientType$: new BehaviorSubject(WowClientType.Retail).asObservable(),
        targetFileInstallComplete$: new Subject<boolean>(),
        addonsChanged$: new BehaviorSubject([]),
        selectedWowInstallation$: new BehaviorSubject({}),
        rescanComplete$: new BehaviorSubject(0).asObservable(),
        enableControls$: new BehaviorSubject(true).asObservable(),
        setEnableControls: () => {},
      },
    );
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

  describe("install events", () => {
    function createAddon(overrides: Partial<Addon> = {}): Addon {
      return {
        id: "dep-1",
        name: "Syndicator",
        providerName: "Curse",
        externalId: "2002",
        installationId: "install-1",
        installedFolderList: [],
        ...overrides,
      } as Addon;
    }

    function rows(): AddonViewModel[] {
      return (component as any)._baseRowDataSrc.value;
    }

    beforeEach(() => {
      // Only once the component is up, so its startup load still finds no installation and bails out early
      sessionServiceSpy.getSelectedWowInstallation.and.returnValue({ id: "install-1" });
      addonServiceSpy.isInstalling = jasmine.createSpy("isInstalling").and.returnValue(false);
      addonServiceSpy.getAddonById = jasmine.createSpy("getAddonById").and.resolveTo(undefined);
    });

    it("should add a row for a new addon as soon as its install is pending", () => {
      addonInstalledSrc.next({ addon: createAddon(), installState: AddonInstallState.Pending, progress: 0 });

      expect(rows().map((r) => r.addon?.id)).toEqual(["dep-1"]);
      expect(rows()[0].isInstalling).toBeTrue();
    });

    it("should add the row only once while the install progresses", () => {
      addonInstalledSrc.next({ addon: createAddon(), installState: AddonInstallState.Pending, progress: 0 });
      addonInstalledSrc.next({ addon: createAddon(), installState: AddonInstallState.Downloading, progress: 25 });

      expect(rows().length).toEqual(1);
    });

    it("should replace the pending row with the installed addon when complete", () => {
      addonInstalledSrc.next({ addon: createAddon(), installState: AddonInstallState.Pending, progress: 0 });
      addonInstalledSrc.next({
        addon: createAddon({ installedVersion: "1.0.0" }),
        installState: AddonInstallState.Complete,
        progress: 100,
      });

      expect(rows().length).toEqual(1);
      expect(rows()[0].isInstalling).toBeFalse();
      expect(rows()[0].addon?.installedVersion).toEqual("1.0.0");
    });

    it("should drop the pending row when the install fails and nothing was saved", async () => {
      addonInstalledSrc.next({ addon: createAddon(), installState: AddonInstallState.Pending, progress: 0 });
      addonInstalledSrc.next({ addon: createAddon(), installState: AddonInstallState.Error, progress: 100 });
      await fixture.whenStable();

      expect(rows().length).toEqual(0);
    });

    it("should keep the saved addon when the install fails", async () => {
      addonServiceSpy.getAddonById.and.resolveTo(createAddon());
      addonInstalledSrc.next({ addon: createAddon(), installState: AddonInstallState.Pending, progress: 0 });
      addonInstalledSrc.next({ addon: createAddon(), installState: AddonInstallState.Error, progress: 100 });
      await fixture.whenStable();

      expect(rows().length).toEqual(1);
      expect(rows()[0].isInstalling).toBeFalse();
    });

    it("should ignore events for another installation", () => {
      addonInstalledSrc.next({
        addon: createAddon({ installationId: "install-2" }),
        installState: AddonInstallState.Pending,
        progress: 0,
      });

      expect(rows().length).toEqual(0);
    });
  });
});
