import { HttpClient, HttpClientModule } from "@angular/common/http";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { httpLoaderFactory } from "../../app.module";
import { MatModule } from "../../mat-module";
import { MatIcon } from "@angular/material/icon";
import { MatIconTestingModule } from "@angular/material/icon/testing";
import { FundingButtonComponent } from "./funding-button.component";

describe("FundingButtonComponent", () => {
  let component: FundingButtonComponent;
  let fixture: ComponentFixture<FundingButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FundingButtonComponent, MatIcon],
      imports: [
        MatModule,
        HttpClientModule,
        NoopAnimationsModule,
        MatIconTestingModule,
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
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(FundingButtonComponent);
    component = fixture.componentInstance;
    component.funding = {
      platform: "TEST",
      url: "TEST",
    };
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
