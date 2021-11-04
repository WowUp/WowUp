import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { Subject } from "rxjs";

import { HttpClient, HttpClientModule } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";

import { httpLoaderFactory } from "../../../app.module";
import { MatModule } from "../../../modules/mat-module";
import { AddonUpdateEvent } from "../../../models/wowup/addon-update-event";
import { ElectronService } from "../../../services";
import { AddonService } from "../../../services/addons/addon.service";
import { AnalyticsService } from "../../../services/analytics/analytics.service";
import { ProgressButtonComponent } from "../../common/progress-button/progress-button.component";
import { AddonUpdateButtonComponent } from "./addon-update-button.component";

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
