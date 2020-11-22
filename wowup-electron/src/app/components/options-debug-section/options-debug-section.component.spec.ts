import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { OptionsDebugSectionComponent } from "./options-debug-section.component";
import { AddonService } from "../../services/addons/addon.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { httpLoaderFactory } from "../../app.module";

describe("OptionsDebugSectionComponent", () => {
  let component: OptionsDebugSectionComponent;
  let addonService: AddonService;
  let wowUpService: WowUpService;
  let addonServiceSpy: any;
  let wowUpServiceSpy: any;
  let fixture: ComponentFixture<OptionsDebugSectionComponent>;

  beforeEach(async () => {
    addonServiceSpy = jasmine.createSpyObj(AddonService, ["logDebugData"]);
    wowUpServiceSpy = jasmine.createSpyObj(WowUpService, ["showLogsFolder"]);

    await TestBed.configureTestingModule({
      declarations: [OptionsDebugSectionComponent],
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
    }).overrideComponent(OptionsDebugSectionComponent, {
      set: {
      providers: [
          { provide: AddonService, useValue: addonServiceSpy },
          { provide: WowUpService, useValue: wowUpServiceSpy },
      ]},
    }).compileComponents();

    fixture = TestBed.createComponent(OptionsDebugSectionComponent);
    component = fixture.componentInstance;
    addonService = fixture.debugElement.injector.get(AddonService);
    wowUpService = fixture.debugElement.injector.get(WowUpService);

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("Should call logDebugData", fakeAsync(() => {
    const button = fixture.debugElement.nativeElement.querySelector("button[action='LogDebugData']");
    button.click();
    tick();
    expect(addonServiceSpy.logDebugData).toHaveBeenCalled();
  }));

  it("Should call showLogFiles", fakeAsync(() => {
    const button = fixture.debugElement.nativeElement.querySelector("button[action='ShowLogFiles']");
    button.click();
    tick();
    expect(wowUpServiceSpy.showLogsFolder).toHaveBeenCalled();
  }));
});
