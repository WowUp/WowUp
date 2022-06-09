import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { BehaviorSubject } from "rxjs";

import { OverlayContainer } from "@angular/cdk/overlay";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";

import { httpLoaderFactory } from "../../../app.module";
import { MatModule } from "../../../modules/mat-module";
import { ElectronService } from "../../../services";
import { WowUpService } from "../../../services/wowup/wowup.service";
import { TitlebarComponent } from "./titlebar.component";

describe("TitlebarComponent", () => {
  let component: TitlebarComponent;
  let fixture: ComponentFixture<TitlebarComponent>;
  let electronServiceSpy: any;
  let wowUpServiceSpy: any;

  beforeEach(async () => {
    electronServiceSpy = jasmine.createSpyObj(
      "ElectronService",
      {
        on: undefined,
        invoke: new Promise(() => {}),
      },
      {
        windowMaximized$: new BehaviorSubject(false).asObservable(),
      }
    );
    wowUpServiceSpy = jasmine.createSpyObj("WowUpService", [""], {
      currentTheme: "horde ofc",
    });

    await TestBed.configureTestingModule({
      declarations: [TitlebarComponent],
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
    })
      .overrideComponent(TitlebarComponent, {
        set: {
          providers: [
            OverlayContainer,
            { provide: ElectronService, useValue: electronServiceSpy },
            { provide: WowUpService, useValue: wowUpServiceSpy },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TitlebarComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
