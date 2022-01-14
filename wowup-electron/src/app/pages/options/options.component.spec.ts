import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ElectronService } from "../../services/electron/electron.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { OptionsComponent } from "./options.component";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { httpLoaderFactory } from "../../app.module";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { MatModule } from "../../modules/mat-module";
import { SessionService } from "../../services/session/session.service";
import { BehaviorSubject } from "rxjs";

describe("OptionsComponent", () => {
  let component: OptionsComponent;
  let fixture: ComponentFixture<OptionsComponent>;
  let electronServiceSpy: any;
  let wowUpServiceSpy: any;
  let sessionService: any;

  beforeEach(async () => {
    sessionService = jasmine.createSpyObj("SessionService", [""], {
      currentTheme$: new BehaviorSubject("default-theme"),
    });

    wowUpServiceSpy = jasmine.createSpyObj(
      "WowUpService",
      {},
      {
        currentTheme: "horde ofc",
      }
    );
    electronServiceSpy = jasmine.createSpyObj("ElectronService", [""], {
      isWin: false,
      isLinux: true,
      isMac: false,
    });

    await TestBed.configureTestingModule({
      declarations: [OptionsComponent],
      imports: [
        MatModule,
        NoopAnimationsModule,
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
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
      .overrideComponent(OptionsComponent, {
        set: {
          providers: [
            { provide: ElectronService, useValue: electronServiceSpy },
            { provide: SessionService, useValue: sessionService },
            { provide: WowUpService, useValue: wowUpServiceSpy },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(OptionsComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
