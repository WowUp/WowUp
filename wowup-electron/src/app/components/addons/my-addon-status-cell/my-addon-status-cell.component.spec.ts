import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { Subject } from "rxjs";

import { HttpClient, HttpClientModule } from "@angular/common/http";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { ICellRendererParams } from "ag-grid-community";
import { Addon, AddonChannelType, WowClientType, WowInstallation } from "wowup-lib-core";

import { httpLoaderFactory } from "../../../app.module";
import { AddonViewModel } from "../../../business-objects/addon-view-model";
import { WarcraftInstallationService } from "../../../services/warcraft/warcraft-installation.service";
import { MatModule } from "../../../modules/mat-module";
import { AddonUpdateEvent } from "../../../models/wowup/addon-update-event";
import { AddonService } from "../../../services/addons/addon.service";
import { MyAddonStatusCellComponent } from "./my-addon-status-cell.component";

describe("MyAddonStatusCellComponent", () => {
  let component: MyAddonStatusCellComponent;
  let fixture: ComponentFixture<MyAddonStatusCellComponent>;
  let addonServiceSpy: AddonService;
  let warcraftInstallationServiceSpy: jasmine.SpyObj<WarcraftInstallationService>;
  let installation: WowInstallation;

  beforeEach(async () => {
    warcraftInstallationServiceSpy = jasmine.createSpyObj<WarcraftInstallationService>("WarcraftInstallationService", [
      "getWowInstallation",
    ]);
    warcraftInstallationServiceSpy.getWowInstallation.and.callFake((id) =>
      id === installation?.id ? installation : undefined,
    );

    addonServiceSpy = jasmine.createSpyObj(
      "AddonService",
      {
        getAddons: Promise.resolve([]),
        backfillAddons: Promise.resolve(undefined),
        getInstallStatus: undefined,
      },
      {
        addonInstalled$: new Subject<AddonUpdateEvent>().asObservable(),
        addonRemoved$: new Subject<string>().asObservable(),
      },
    );

    await TestBed.configureTestingModule({
      declarations: [MyAddonStatusCellComponent],
      providers: [MatDialog],
      imports: [
        MatModule,
        HttpClientModule,
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
    })
      .overrideComponent(MyAddonStatusCellComponent, {
        set: {
          providers: [
            { provide: AddonService, useValue: addonServiceSpy },
            { provide: WarcraftInstallationService, useValue: warcraftInstallationServiceSpy },
          ],
        },
      })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MyAddonStatusCellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("game version mismatch indicator", () => {
    function init(addonOverrides: Partial<Addon>, installationOverrides: Partial<WowInstallation> = {}): void {
      installation = {
        id: "install-1",
        clientType: WowClientType.Retail,
        location: "G:/WoW/_retail_/Wow.exe",
        label: "Retail",
        displayName: "Retail",
        selected: true,
        defaultAddonChannelType: AddonChannelType.Stable,
        defaultAutoUpdate: false,
        gameVersion: "12.1.5",
        ...installationOverrides,
      };

      const addon = {
        id: "addon-1",
        name: "Baganator",
        installationId: "install-1",
        installedVersion: "1.1.0",
        latestVersion: "1.2.0",
        gameVersion: ["12.1.7"],
        isIgnored: false,
        ...addonOverrides,
      } as Addon;

      const listItem = { addon, isUpToDate: () => false, stateTextTranslationKey: "" } as unknown as AddonViewModel;
      component.agInit({ data: listItem } as ICellRendererParams);
    }

    it("shows when the update needs a newer game version than the installation runs", () => {
      init({});
      expect(component.versionMismatchTooltip).not.toEqual("");
    });

    it("stays hidden when the installation can run the update", () => {
      init({ gameVersion: ["12.1.5"] });
      expect(component.versionMismatchTooltip).toEqual("");
    });

    it("stays hidden when there is no update to hold back", () => {
      init({ latestVersion: "1.1.0" });
      expect(component.versionMismatchTooltip).toEqual("");
    });

    it("stays hidden for an ignored addon", () => {
      init({ isIgnored: true });
      expect(component.versionMismatchTooltip).toEqual("");
    });

    it("stays hidden once the user ignored the mismatch for the current game version", () => {
      init({}, { ignoredCompatibilityVersion: "12.1.5" });
      expect(component.versionMismatchTooltip).toEqual("");
    });

    it("stays hidden when the game version of the installation is unknown", () => {
      init({}, { gameVersion: undefined });
      expect(component.versionMismatchTooltip).toEqual("");
    });
  });
});
