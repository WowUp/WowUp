import { ComponentFixture, TestBed } from "@angular/core/testing";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { httpLoaderFactory } from "../../app.module";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { MatDialogModule } from "@angular/material/dialog";
import { MyAddonsAddonCellComponent } from "./my-addons-addon-cell.component";
import { MatTooltipModule } from "@angular/material/tooltip";
import { AddonViewModel } from "../../business-objects/my-addon-list-item";
import { Addon } from "../../entities/addon";

describe("MyAddonsAddonCellComponent", () => {
  let component: MyAddonsAddonCellComponent;
  let fixture: ComponentFixture<MyAddonsAddonCellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MyAddonsAddonCellComponent],
      imports: [
        MatTooltipModule,
        MatDialogModule,
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
        })
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
