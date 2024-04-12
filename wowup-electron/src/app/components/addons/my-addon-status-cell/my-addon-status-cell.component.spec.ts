import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { Subject } from "rxjs";

import { HttpClient, HttpClientModule } from "@angular/common/http";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";

import { httpLoaderFactory } from "../../../app.module";
import { MatModule } from "../../../modules/mat-module";
import { AddonUpdateEvent } from "../../../models/wowup/addon-update-event";
import { AddonService } from "../../../services/addons/addon.service";
import { MyAddonStatusCellComponent } from "./my-addon-status-cell.component";

describe("MyAddonStatusCellComponent", () => {
  let component: MyAddonStatusCellComponent;
  let fixture: ComponentFixture<MyAddonStatusCellComponent>;
  let addonServiceSpy: AddonService;

  beforeEach(async () => {
    addonServiceSpy = jasmine.createSpyObj(
      "AddonService",
      {
        getAddons: Promise.resolve([]),
        backfillAddons: Promise.resolve(undefined),
      },
      {
        addonInstalled$: new Subject<AddonUpdateEvent>().asObservable(),
        addonRemoved$: new Subject<string>().asObservable(),
      },
    );

    await TestBed.configureTestingModule({
      declarations: [MyAddonStatusCellComponent],
      providers: [MatDialog],
      imports: [
        MatModule,
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
      .overrideComponent(MyAddonStatusCellComponent, {
        set: {
          providers: [{ provide: AddonService, useValue: addonServiceSpy }],
        },
      })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MyAddonStatusCellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
