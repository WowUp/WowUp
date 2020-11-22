import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ElectronService } from "../../services/electron/electron.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { OptionsComponent } from "./options.component";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { httpLoaderFactory } from "../../app.module";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";

describe("OptionsComponent", () => {
  let component: OptionsComponent;
  let fixture: ComponentFixture<OptionsComponent>;
  let addonService: ElectronService;
  let wowUpService: WowUpService;
  let electronServiceSpy: any;
  let wowUpServiceSpy: any;

  beforeEach(async () => {
    wowUpServiceSpy = jasmine.createSpyObj("WowUpService", {
      getThemeLogoPath: () => "",
    }, {
      currentTheme: "horde ofc",
    });
    electronServiceSpy = jasmine.createSpyObj("ElectronService", ["a"], {
      isWin : false,
      isLinux : true,
      isMax: false,
    });

    await TestBed.configureTestingModule({
      declarations: [OptionsComponent],
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
    }).overrideComponent(OptionsComponent, {
      set: {
        providers: [
          { provide: WowUpService, useValue: wowUpServiceSpy },
          { provide: ElectronService, useValue: electronServiceSpy },
        ]},
    }).compileComponents();

    fixture = TestBed.createComponent(OptionsComponent);
    component = fixture.componentInstance;
    wowUpService = fixture.debugElement.injector.get(WowUpService);
    addonService = fixture.debugElement.injector.get(ElectronService);

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
