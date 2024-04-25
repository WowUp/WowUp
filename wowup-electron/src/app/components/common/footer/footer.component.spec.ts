import { UpdateCheckResult } from "electron-updater";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { BehaviorSubject, Subject } from "rxjs";

import { OverlayModule } from "@angular/cdk/overlay";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatIconTestingModule } from "@angular/material/icon/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";

import { httpLoaderFactory } from "../../../app.module";
import { MatModule } from "../../../modules/mat-module";
import { ElectronService } from "../../../services";
import { LinkService } from "../../../services/links/link.service";
import { SessionService } from "../../../services/session/session.service";
import { WowUpService } from "../../../services/wowup/wowup.service";
import { mockPreload } from "../../../tests/test-helpers";
import { FooterComponent } from "./footer.component";

/** Fix icon warning? https://stackoverflow.com/a/62277810 */
describe("FooterComponent", () => {
  let fixture: ComponentFixture<FooterComponent>;
  let wowUpServiceSpy: WowUpService;
  let sessionServiceSpy: SessionService;
  let electronService: ElectronService;
  let linkService: LinkService;

  beforeEach(async () => {
    mockPreload();

    wowUpServiceSpy = jasmine.createSpyObj("WowUpService", [], {
      getApplicationVersion: () => Promise.resolve("TESTV"),
      wowupUpdateCheck$: new Subject<UpdateCheckResult>().asObservable(),
      wowupUpdateDownloaded$: new Subject<any>().asObservable(),
      wowupUpdateDownloadInProgress$: new Subject<boolean>().asObservable(),
    });

    sessionServiceSpy = jasmine.createSpyObj("SessionService", [""], {
      statusText$: new BehaviorSubject(""),
      pageContextText$: new BehaviorSubject(""),
      wowUpAccount$: new Subject(),
    });

    linkService = jasmine.createSpyObj("LinkService", [""], {});

    electronService = jasmine.createSpyObj("ElectronService", [""], {
      appUpdate$: new Subject(),
    });

    await TestBed.configureTestingModule({
      declarations: [FooterComponent],
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
            { provide: ElectronService, useValue: electronService },
            { provide: WowUpService, useValue: wowUpServiceSpy },
            { provide: SessionService, useValue: sessionServiceSpy },
            { provide: LinkService, useValue: linkService },
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
