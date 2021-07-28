import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { Subject } from "rxjs";

import { HttpClient, HttpClientModule } from "@angular/common/http";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";

import { httpLoaderFactory } from "../../app.module";
import { AddonViewModel } from "../../business-objects/addon-view-model";
import { Addon } from "../../../common/entities/addon";
import { MatModule } from "../../mat-module";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { AddonService } from "../../services/addons/addon.service";
import { SessionService } from "../../services/session/session.service";
import { overrideIconModule } from "../../tests/mock-mat-icon";
import { AddonDetailComponent, AddonDetailModel } from "./addon-detail.component";
import { mockPreload } from "../../tests/test-helpers";
import { WowUpService } from "../../services/wowup/wowup.service";
import { LinkService } from "../../services/links/link.service";
import { GalleryModule } from "ng-gallery";
import { LightboxModule } from "ng-gallery/lightbox";

describe("AddonDetailComponent", () => {
  let dialogModel: AddonDetailModel;
  let addonServiceSpy: any;
  let sessionServiceSpy: SessionService;
  let wowUpService: WowUpService;
  let linkService: any;

  beforeEach(async () => {
    mockPreload();

    console.log("AddonDetailComponent");
    addonServiceSpy = jasmine.createSpyObj(
      "AddonService",
      ["logDebugData", "getChangelogForAddon", "canShowChangelog"],
      {
        addonInstalled$: new Subject<AddonUpdateEvent>().asObservable(),
        getChangelog: () => "",
      }
    );

    wowUpService = jasmine.createSpyObj("WowUpService", [""], {});
    linkService = jasmine.createSpyObj("LinkService", [""], {});

    sessionServiceSpy = jasmine.createSpyObj("SessionService", ["getSelectedClientType", "getSelectedDetailsTab"], {
      getSelectedWowInstallation: () => "description",
    });

    const viewModel = new AddonViewModel({
      installedVersion: "1.0.0",
      externalId: "52001",
    } as Addon);

    dialogModel = { listItem: viewModel } as AddonDetailModel;

    let testBed = TestBed.configureTestingModule({
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
    });

    testBed = overrideIconModule(testBed).overrideComponent(AddonDetailComponent, {
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
        ],
      },
    });

    await testBed.compileComponents();
  });

  it("should create", () => {
    const fixture = TestBed.createComponent(AddonDetailComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
