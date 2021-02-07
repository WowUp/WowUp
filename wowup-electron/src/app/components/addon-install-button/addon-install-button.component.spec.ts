import { ComponentFixture, TestBed } from "@angular/core/testing";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { AddonInstallButtonComponent } from "./addon-install-button.component";
import { AddonService } from "../../services/addons/addon.service";
import { SessionService } from "../../services/session/session.service";
import { httpLoaderFactory } from "../../app.module";
import { AddonSearchResult } from "../../models/wowup/addon-search-result";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { Subject } from "rxjs";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { ProgressButtonComponent } from "../progress-button/progress-button.component";

describe("AddonInstallButtonComponent", () => {
  let component: AddonInstallButtonComponent;
  let fixture: ComponentFixture<AddonInstallButtonComponent>;
  let addonService: AddonService;
  let addonServiceSpy: any;
  let sessionService: SessionService;
  let sessionServiceSpy: any;

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

    fixture = TestBed.createComponent(AddonInstallButtonComponent);
    component = fixture.componentInstance;
    addonService = fixture.debugElement.injector.get(AddonService);
    sessionService = fixture.debugElement.injector.get(SessionService);

    component.addonSearchResult = {
      externalId: "123123",
    } as AddonSearchResult;

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
