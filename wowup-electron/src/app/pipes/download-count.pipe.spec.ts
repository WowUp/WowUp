import { ComponentFixture, TestBed } from "@angular/core/testing";
import { DownloadCountPipe } from "./download-count.pipe";
import { Component } from "@angular/core";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { httpLoaderFactory } from "../app.module";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";

@Component({
  template: `<p>{{ number | downloadCount }}</p>`,
})
class TestDownloadCountComponent {
  public number: number = 0;
}

describe("DownloadCountPipe", () => {
  let component: TestDownloadCountComponent;
  let fixture: ComponentFixture<TestDownloadCountComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestDownloadCountComponent, DownloadCountPipe],
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

    fixture = TestBed.createComponent(TestDownloadCountComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  const inputs = {
    "e+0": 1,
    "e+1": 10,
    "e+2": 100,
    "e+3": 1000,
    "e+4": 10000,
    "e+5": 100000,
    "e+6": 1000000,
    "e+7": 10000000,
    "e+8": 100000000,
    "e+9": 1000000000,
  };

  for (let index in inputs) {
    let number = inputs[index];
    it(`should transform the number ${number} to ${index}`, () => {
      component.number = number;
      fixture.detectChanges();
      let p = fixture.debugElement.nativeElement.querySelector("p");
      expect(p.innerHTML).toBe(`COMMON.DOWNLOAD_COUNT.${index}`);
    });
  }
});
