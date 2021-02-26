import { ComponentFixture, TestBed } from "@angular/core/testing";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { MatDialog } from "@angular/material/dialog";
import { AnalyticsService } from "../../services/analytics/analytics.service";
import { AddonService } from "../../services/addons/addon.service";
import { ElectronService } from "../../services";
import { httpLoaderFactory } from "../../app.module";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { AddonUpdateButtonComponent } from "./addon-update-button.component";
import { Subject } from "rxjs";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { MatModule } from "../../mat-module";
import { ProgressButtonComponent } from "../progress-button/progress-button.component";
describe("AddonUpdateButtonComponent", () => {
  let addonServiceSpy: AddonService;
  let analyticsServiceSpy: AnalyticsService;

  beforeEach(async () => {
    addonServiceSpy = jasmine.createSpyObj("AddonService", [""], {
      addonInstalled$: new Subject<AddonUpdateEvent>().asObservable(),
    });

    await TestBed.configureTestingModule({
      declarations: [AddonUpdateButtonComponent, ProgressButtonComponent],
      providers: [MatDialog, ElectronService],
      imports: [
        MatModule,
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
    })
      .overrideComponent(AddonUpdateButtonComponent, {
        set: {
          providers: [
            MatDialog,
            { provide: AddonService, useValue: addonServiceSpy },
            { provide: AnalyticsService, useValue: analyticsServiceSpy },
          ],
        },
      })
      .compileComponents();
  });

  it("should create", () => {
    const fixture = TestBed.createComponent(AddonUpdateButtonComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
