import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";

import { HttpClient, HttpClientModule } from "@angular/common/http";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";

import { httpLoaderFactory } from "../../../app.module";
import { AddonViewModel } from "../../../business-objects/addon-view-model";
import { MatModule } from "../../../modules/mat-module";
import { SessionService } from "../../../services/session/session.service";
import { MyAddonsAddonCellComponent } from "./my-addons-addon-cell.component";
import { BehaviorSubject } from "rxjs";
import { Addon, AddonChannelType, WowClientType } from "wowup-lib-core";

describe("MyAddonsAddonCellComponent", () => {
  let component: MyAddonsAddonCellComponent;
  let fixture: ComponentFixture<MyAddonsAddonCellComponent>;
  let sessionService: SessionService;

  beforeEach(async () => {
    sessionService = jasmine.createSpyObj("SessionService", [""], {
      myAddonsCompactVersion$: new BehaviorSubject(false),
    });

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
    })
      .overrideComponent(MyAddonsAddonCellComponent, {
        set: {
          providers: [{ provide: SessionService, useValue: sessionService }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MyAddonsAddonCellComponent);
    component = fixture.componentInstance;

    component.listItem = new AddonViewModel({
      name: "Test Tool",
      dependencies: [],
      isIgnored: false,
      isLoadOnDemand: false,
      autoUpdateEnabled: false,
      autoUpdateNotificationsEnabled: false,
      clientType: WowClientType.Retail,
      channelType: AddonChannelType.Stable,
    } as Addon);

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
