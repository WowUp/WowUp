import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Component } from "@angular/core";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { httpLoaderFactory } from "../app.module";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { RelativeDurationPipe } from "./relative-duration-pipe";

@Component({
  template: `<p>{{ date | relativeDuration }}</p>`,
})
class TestRelativeDurationComponent {
  public date = new Date().toString();
}

describe("RelativeDurationPipe", () => {
  let component: TestRelativeDurationComponent;
  let fixture: ComponentFixture<TestRelativeDurationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestRelativeDurationComponent, RelativeDurationPipe],
      imports: [HttpClientModule, TranslateModule.forRoot({
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

    fixture = TestBed.createComponent(TestRelativeDurationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
