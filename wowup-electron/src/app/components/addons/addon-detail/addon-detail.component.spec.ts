import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { Subject } from "rxjs";

import { HttpClient, HttpClientModule } from "@angular/common/http";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";

import { httpLoaderFactory } from "../../../app.module";
import { AddonViewModel } from "../../../business-objects/addon-view-model";
import { AddonUpdateEvent } from "../../../models/wowup/addon-update-event";
import { AddonService } from "../../../services/addons/addon.service";
import { SessionService } from "../../../services/session/session.service";
import { AddonDetailComponent, AddonDetailModel } from "./addon-detail.component";
import { mockPreload } from "../../../tests/test-helpers";
import { WowUpService } from "../../../services/wowup/wowup.service";
import { LinkService } from "../../../services/links/link.service";
import { GalleryModule } from "ng-gallery";
import { LightboxModule } from "ng-gallery/lightbox";
import { MatModule } from "../../../modules/mat-module";
import { AddonUiService } from "../../../services/addons/addon-ui.service";
import { AddonProviderFactory } from "../../../services/addons/addon.provider.factory";
import { Addon, AddonDependencyType, WowInstallation } from "wowup-lib-core";
import { AddonInstallState } from "../../../models/wowup/addon-install-state";

describe("AddonDetailComponent", () => {
  const installation = { id: "install-1" } as WowInstallation;
  let dialogModel: AddonDetailModel;
  let addonServiceSpy: any;
  let sessionServiceSpy: SessionService;
  let wowUpService: WowUpService;
  let linkService: any;
  let addonUiService: any;
  let addonProviderService: any;
  let addonInstalledSrc: Subject<AddonUpdateEvent>;

  beforeEach(async () => {
    mockPreload();

    console.log("AddonDetailComponent");
    addonInstalledSrc = new Subject<AddonUpdateEvent>();
    addonServiceSpy = jasmine.createSpyObj(
      "AddonService",
      ["logDebugData", "getChangelogForAddon", "canShowChangelog", "getDependencyDetails"],
      {
        addonInstalled$: addonInstalledSrc.asObservable(),
        getChangelog: () => "",
      },
    );

    addonUiService = jasmine.createSpyObj("AddonUiService", [""], {});
    wowUpService = jasmine.createSpyObj("WowUpService", [""], {});
    linkService = jasmine.createSpyObj("LinkService", [""], {});
    addonProviderService = jasmine.createSpyObj("AddonProviderFactory", [""], {});

    sessionServiceSpy = jasmine.createSpyObj("SessionService", ["getSelectedClientType", "getSelectedDetailsTab"], {
      getSelectedWowInstallation: () => installation,
    });

    const viewModel = new AddonViewModel({
      installedVersion: "1.0.0",
      externalId: "52001",
    } as Addon);

    dialogModel = { listItem: viewModel } as AddonDetailModel;

    const testBed = TestBed.configureTestingModule({
      declarations: [AddonDetailComponent],
      imports: [
        MatModule,
        HttpClientModule,
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
        GalleryModule,
        LightboxModule,
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [{ provide: MAT_DIALOG_DATA, useValue: dialogModel }],
    }).overrideComponent(AddonDetailComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: {} },
          { provide: AddonService, useValue: addonServiceSpy },
          { provide: SessionService, useValue: sessionServiceSpy },
          { provide: LinkService, useValue: linkService },
          {
            provide: WowUpService,
            useValue: wowUpService,
          },
          { provide: AddonUiService, useValue: addonUiService },
          { provide: AddonProviderFactory, useValue: addonProviderService },
        ],
      },
    });

    await testBed.compileComponents();
  });

  it("should create", () => {
    const fixture = TestBed.createComponent(AddonDetailComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe("required dependencies", () => {
    const dependencies = [
      { externalAddonId: "2002", type: AddonDependencyType.Required },
      { externalAddonId: "3003", type: AddonDependencyType.Optional },
    ];

    beforeEach(() => {
      dialogModel.listItem = new AddonViewModel({
        id: "addon-1",
        name: "Baganator",
        providerName: "Curse",
        installedVersion: "1.0.0",
        externalId: "1001",
        dependencies,
      } as Addon);
      addonServiceSpy.getDependencyDetails.and.resolveTo([
        { externalAddonId: "2002", name: "Syndicator", installed: false },
      ]);
    });

    async function loadDetails(component: AddonDetailComponent) {
      await (component as any).loadDependencyDetails();
    }

    it("should start collapsed and toggle open and closed", () => {
      const component = TestBed.createComponent(AddonDetailComponent).componentInstance;

      expect(component.dependenciesExpanded).toBeFalse();
      component.toggleDependencies();
      expect(component.dependenciesExpanded).toBeTrue();
      component.toggleDependencies();
      expect(component.dependenciesExpanded).toBeFalse();
    });

    it("should resolve the names of required dependencies only", async () => {
      const component = TestBed.createComponent(AddonDetailComponent).componentInstance;
      const emitted: any[] = [];
      component.dependencyDetails$.subscribe((details) => emitted.push(details));

      await loadDetails(component);

      expect(addonServiceSpy.getDependencyDetails).toHaveBeenCalledWith([dependencies[0]], "Curse", installation);
      expect(emitted[emitted.length - 1]).toEqual([{ externalAddonId: "2002", name: "Syndicator", installed: false }]);
    });

    it("should mark a dependency installed once it finishes installing", async () => {
      const component = TestBed.createComponent(AddonDetailComponent).componentInstance;
      let latest: any[] = [];
      component.dependencyDetails$.subscribe((details) => (latest = details));
      await loadDetails(component);

      addonInstalledSrc.next({
        addon: { id: "dep-1", name: "Syndicator", providerName: "Curse", externalId: "2002" } as Addon,
        installState: AddonInstallState.Installing,
        progress: 75,
      });
      expect(latest[0].installed).toBeFalse();

      addonInstalledSrc.next({
        addon: { id: "dep-1", name: "Syndicator", providerName: "Curse", externalId: "2002" } as Addon,
        installState: AddonInstallState.Complete,
        progress: 100,
      });
      expect(latest[0].installed).toBeTrue();
    });

    it("should ignore the same id installed from another provider", async () => {
      const component = TestBed.createComponent(AddonDetailComponent).componentInstance;
      let latest: any[] = [];
      component.dependencyDetails$.subscribe((details) => (latest = details));
      await loadDetails(component);

      addonInstalledSrc.next({
        addon: { id: "other-1", name: "Other", providerName: "Wago", externalId: "2002" } as Addon,
        installState: AddonInstallState.Complete,
        progress: 100,
      });

      expect(latest[0].installed).toBeFalse();
    });
  });
});
