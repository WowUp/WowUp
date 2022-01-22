import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { OptionsDebugSectionComponent } from "./options-debug-section.component";
import { AddonService } from "../../../services/addons/addon.service";
import { WowUpService } from "../../../services/wowup/wowup.service";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { httpLoaderFactory } from "../../../app.module";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { MatModule } from "../../../modules/mat-module";
import { SessionService } from "../../../services/session/session.service";

describe("OptionsDebugSectionComponent", () => {
  let component: OptionsDebugSectionComponent;
  let fixture: ComponentFixture<OptionsDebugSectionComponent>;
  let addonServiceSpy: any;
  let wowUpServiceSpy: any;
  let sessionService: any;

  beforeEach(async () => {
    addonServiceSpy = jasmine.createSpyObj(AddonService, ["logDebugData"]);
    wowUpServiceSpy = jasmine.createSpyObj(WowUpService, ["showLogsFolder"]);
    sessionService = jasmine.createSpyObj("SessionService", [""], {});

    await TestBed.configureTestingModule({
      declarations: [OptionsDebugSectionComponent],
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
      .overrideComponent(OptionsDebugSectionComponent, {
        set: {
          providers: [
            { provide: AddonService, useValue: addonServiceSpy },
            { provide: WowUpService, useValue: wowUpServiceSpy },
            { provide: SessionService, useValue: sessionService },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(OptionsDebugSectionComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("Should call logDebugData", fakeAsync(() => {
    const button = fixture.debugElement.nativeElement.querySelector("#dump-debug-btn");
    button.click();
    tick();
    expect(addonServiceSpy.logDebugData).toHaveBeenCalled();
  }));

  it("Should call showLogFiles", fakeAsync(() => {
    const button = fixture.debugElement.nativeElement.querySelector("#show-log-btn");
    button.click();
    tick();
    expect(wowUpServiceSpy.showLogsFolder).toHaveBeenCalled();
  }));
});
