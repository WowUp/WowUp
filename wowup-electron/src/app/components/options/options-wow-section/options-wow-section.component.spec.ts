import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { BehaviorSubject } from "rxjs";

import { HttpClient, HttpClientModule } from "@angular/common/http";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";

import { httpLoaderFactory } from "../../../app.module";
import { InstalledProduct } from "../../../models/warcraft/installed-product";
import { WarcraftService } from "../../../services/warcraft/warcraft.service";
import { WowUpService } from "../../../services/wowup/wowup.service";
import { WowClientOptionsComponent } from "../wow-client-options/wow-client-options.component";
import { OptionsWowSectionComponent } from "./options-wow-section.component";
import { WarcraftInstallationService } from "../../../services/warcraft/warcraft-installation.service";
import { MatModule } from "../../../modules/mat-module";
import { WowUpReleaseChannelType } from "../../../../common/wowup/wowup-release-channel-type";
import { AddonChannelType, WowClientType } from "wowup-lib-core";

describe("OptionsWowSectionComponent", () => {
  let component: OptionsWowSectionComponent;
  let fixture: ComponentFixture<OptionsWowSectionComponent>;
  let wowUpServiceSpy: WowUpService;
  let warcraftServiceSpy: WarcraftService;
  let warcraftInstallationService: WarcraftInstallationService;

  beforeEach(async () => {
    warcraftServiceSpy = jasmine.createSpyObj(
      "WarcraftService",
      {
        getClientFolderName: (clientType: WowClientType) => clientType.toString(),
        getClientLocation: (clientType: WowClientType) => clientType.toString(),
      },
      {
        products$: new BehaviorSubject<InstalledProduct[]>([]).asObservable(),
      }
    );

    wowUpServiceSpy = jasmine.createSpyObj(
      "WowUpService",
      {
        getDefaultAddonChannel: () => AddonChannelType.Stable,
        getDefaultAutoUpdate: () => false,
      },
      {
        wowUpReleaseChannel: WowUpReleaseChannelType.Stable,
      }
    );

    warcraftInstallationService = jasmine.createSpyObj("WarcraftInstallationService", [""], {
      wowInstallations$: new BehaviorSubject<any[]>([]),
    });

    await TestBed.configureTestingModule({
      declarations: [OptionsWowSectionComponent, WowClientOptionsComponent],
      imports: [
        MatModule,
        NoopAnimationsModule,
        HttpClientModule,
        MatDialogModule,
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
      providers: [MatDialog],
    })
      .overrideComponent(OptionsWowSectionComponent, {
        set: {
          providers: [
            { provide: WowUpService, useValue: wowUpServiceSpy },
            { provide: WarcraftService, useValue: warcraftServiceSpy },
            { provide: WarcraftInstallationService, useValue: warcraftInstallationService },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(OptionsWowSectionComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
