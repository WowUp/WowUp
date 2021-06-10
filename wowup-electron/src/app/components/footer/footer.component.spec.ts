import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FooterComponent } from "./footer.component";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { httpLoaderFactory } from "../../app.module";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { WowUpService } from "../../services/wowup/wowup.service";
import { SessionService } from "../../services/session/session.service";
import { OverlayModule } from "@angular/cdk/overlay";
import { BehaviorSubject, of, Subject } from "rxjs";
import { UpdateCheckResult } from "electron-updater";
import { MatModule } from "../../mat-module";

import { MatIcon } from "@angular/material/icon";
import { MatIconTestingModule } from "@angular/material/icon/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mockPreload } from "../../tests/test-helpers";

/** Fix icon warning? https://stackoverflow.com/a/62277810 */
describe("FooterComponent", () => {
  let fixture: ComponentFixture<FooterComponent>;
  let wowUpServiceSpy: WowUpService;
  let sessionServiceSpy: SessionService;

  beforeEach(async () => {
    mockPreload();

    wowUpServiceSpy = jasmine.createSpyObj("WowUpService", [], {
      getApplicationVersion: () => Promise.resolve("TESTV"),
      wowupUpdateCheck$: new Subject<UpdateCheckResult>().asObservable(),
      wowupUpdateDownloaded$: new Subject<any>().asObservable(),
      wowupUpdateCheckInProgress$: new Subject<boolean>().asObservable(),
      wowupUpdateDownloadInProgress$: new Subject<boolean>().asObservable(),
    });

    sessionServiceSpy = jasmine.createSpyObj("SessionService", [""], {
      statusText$: new BehaviorSubject(""),
      pageContextText$: new BehaviorSubject(""),
    });

    await TestBed.configureTestingModule({
      declarations: [FooterComponent, MatIcon],
      imports: [
        MatModule,
        NoopAnimationsModule,
        MatIconTestingModule,
        OverlayModule,
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
      .overrideComponent(FooterComponent, {
        set: {
          providers: [
            { provide: WowUpService, useValue: wowUpServiceSpy },
            { provide: SessionService, useValue: sessionServiceSpy },
          ],
        },
      })
      .compileComponents();
  });

  it("should create", () => {
    fixture = TestBed.createComponent(FooterComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
