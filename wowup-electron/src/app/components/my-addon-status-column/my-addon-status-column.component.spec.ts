import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MyAddonStatusColumnComponent } from "./my-addon-status-column.component";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { httpLoaderFactory } from "../../app.module";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";

describe("MyAddonStatusColumnComponent", () => {
  let component: MyAddonStatusColumnComponent;
  let fixture: ComponentFixture<MyAddonStatusColumnComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MyAddonStatusColumnComponent],
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
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MyAddonStatusColumnComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
