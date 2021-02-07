import { ComponentFixture, TestBed } from "@angular/core/testing";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { httpLoaderFactory } from "../../app.module";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { MyAddonsAddonCellComponent } from "./my-addons-addon-cell.component";
import { AddonViewModel } from "../../business-objects/addon-view-model";
import { Addon } from "../../entities/addon";
import { MatModule } from "../../mat-module";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

describe("MyAddonsAddonCellComponent", () => {
  let component: MyAddonsAddonCellComponent;
  let fixture: ComponentFixture<MyAddonsAddonCellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MyAddonsAddonCellComponent],
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
    }).compileComponents();

    fixture = TestBed.createComponent(MyAddonsAddonCellComponent);
    component = fixture.componentInstance;

    component.listItem = new AddonViewModel({
      name: "Teelo's Test Tool",
      dependencies: [],
    } as Addon);

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
