import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { WowUpService } from "../../services/wowup/wowup.service";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { httpLoaderFactory } from "../../app.module";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { OptionsWowSectionComponent } from "./options-wow-section.component";
import { WowUpReleaseChannelType } from "../../models/wowup/wowup-release-channel-type";
import { WowClientOptionsComponent } from "../wow-client-options/wow-client-options.component";
import { ElectronService } from "../../services/electron/electron.service";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { BehaviorSubject } from "rxjs";
import { InstalledProduct } from "../../models/warcraft/installed-product";
import { AddonChannelType } from "../../models/wowup/addon-channel-type";
import { MatModule } from "../../mat-module";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

describe("OptionsWowSectionComponent", () => {
  let component: OptionsWowSectionComponent;
  let fixture: ComponentFixture<OptionsWowSectionComponent>;
  let wowUpService: WowUpService;
  let wowUpServiceSpy: any;
  let warcraftService: WarcraftService;
  let warcraftServiceSpy: any;
  let electronService: ElectronService;

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
    electronService = jasmine.createSpyObj("ElectronService", [""], {});

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
            { provide: ElectronService, useValue: electronService },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(OptionsWowSectionComponent);
    component = fixture.componentInstance;
    wowUpService = fixture.debugElement.injector.get(WowUpService);
    warcraftService = fixture.debugElement.injector.get(WarcraftService);

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
