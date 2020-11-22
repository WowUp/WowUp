import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ProgressSpinnerComponent } from "./progress-spinner.component";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { httpLoaderFactory } from "../../app.module";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";

describe("ProgressSpinnerComponent", () => {
  let component: ProgressSpinnerComponent;
  let fixture: ComponentFixture<ProgressSpinnerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProgressSpinnerComponent],
      imports: [MatProgressSpinnerModule, HttpClientModule, TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useFactory: httpLoaderFactory,
          deps: [HttpClient],
        },
        compiler: {
          provide: TranslateCompiler,
          useClass: TranslateMessageFormatCompiler,
        },
      })],
    }).compileComponents();

    fixture = TestBed.createComponent(ProgressSpinnerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
