import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { Subject } from "rxjs";

import { HttpClient, HttpClientModule } from "@angular/common/http";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";

import { httpLoaderFactory } from "../../app.module";
import { AddonViewModel } from "../../business-objects/addon-view-model";
import { Addon } from "../../entities/addon";
import { MatModule } from "../../mat-module";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { ElectronService } from "../../services";
import { AddonService } from "../../services/addons/addon.service";
import { IconService } from "../../services/icons/icon.service";
import { SessionService } from "../../services/session/session.service";
import { overrideIconModule } from "../../tests/mock-mat-icon";
import { AddonDetailComponent, AddonDetailModel } from "./addon-detail.component";

describe("AddonDetailComponent", () => {
  let component: AddonDetailComponent;
  let fixture: ComponentFixture<AddonDetailComponent>;
  let addonService: AddonService;
  let dialogModel: AddonDetailModel;
  let addonServiceSpy: any;
  let electronServiceSpy: ElectronService;
  let sessionServiceSpy: SessionService;

  beforeEach(async () => {
    console.log("AddonDetailComponent");
    addonServiceSpy = jasmine.createSpyObj(
      "AddonService",
      ["logDebugData", "getChangelogForAddon", "canShowChangelog"],
      {
        addonInstalled$: new Subject<AddonUpdateEvent>().asObservable(),
        getChangelog: () => "",
      }
    );

    electronServiceSpy = jasmine.createSpyObj("ElectronService", [""], {});
    sessionServiceSpy = jasmine.createSpyObj("SessionService", ["getSelectedClientType", "getSelectedDetailsTab"], {});

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
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [{ provide: MAT_DIALOG_DATA, useValue: dialogModel }],
    });

    testBed = overrideIconModule(testBed).overrideComponent(AddonDetailComponent, {
      set: {
        providers: [
          { provide: AddonService, useValue: addonServiceSpy },
          { provide: SessionService, useValue: sessionServiceSpy },
          {
            provide: ElectronService,
            useValue: electronServiceSpy,
          },
          {
            provide: IconService,
          },
        ],
      },
    });

    await testBed.compileComponents();

    fixture = TestBed.createComponent(AddonDetailComponent);
    component = fixture.componentInstance;
    addonService = fixture.debugElement.injector.get(AddonService);
    const icons = fixture.debugElement.injector.get(IconService);

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
