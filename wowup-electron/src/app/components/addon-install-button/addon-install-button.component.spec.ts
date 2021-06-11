import { TestBed } from "@angular/core/testing";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { AddonInstallButtonComponent } from "./addon-install-button.component";
import { AddonService } from "../../services/addons/addon.service";
import { SessionService } from "../../services/session/session.service";
import { httpLoaderFactory } from "../../app.module";
import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { Subject } from "rxjs";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { ProgressButtonComponent } from "../progress-button/progress-button.component";

describe("AddonInstallButtonComponent", () => {
  let addonServiceSpy: AddonService;
  let sessionServiceSpy: SessionService;

  beforeEach(async () => {
    addonServiceSpy = jasmine.createSpyObj(
      "AddonService",
      {
        isInstalled: () => false,
      },
      {
        addonInstalled$: new Subject<AddonUpdateEvent>().asObservable(),
      }
    );
    sessionServiceSpy = jasmine.createSpyObj("SessionService", ["getSelectedClientType"], {
      selectedClientType: WowClientType.Retail,
    });

    await TestBed.configureTestingModule({
      declarations: [AddonInstallButtonComponent, ProgressButtonComponent],
      imports: [
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
      .overrideComponent(AddonInstallButtonComponent, {
        set: {
          providers: [
            { provide: AddonService, useValue: addonServiceSpy },
            { provide: SessionService, useValue: sessionServiceSpy },
          ],
        },
      })
      .compileComponents();
  });

  it("should create", () => {
    const fixture = TestBed.createComponent(AddonInstallButtonComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
