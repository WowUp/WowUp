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
import { MetricsApiService } from "../../../services/api/metrics-api.service";
import { MetricsSnapshot } from "../../../../common/models/process-metrics";

const SNAPSHOT: MetricsSnapshot = {
  takenAt: 1700000000000,
  flavor: "ow",
  window: { visible: true, minimized: false, focused: true },
  processes: [
    { pid: 1, type: "Browser", cpuPercent: 1.2, memoryMb: 94 },
    { pid: 2, type: "Tab", cpuPercent: 10.9, memoryMb: 229.6 },
  ],
  totalCpuPercent: 12.1,
  totalMemoryMb: 323.6,
  cpuMeasured: true,
};

describe("OptionsDebugSectionComponent", () => {
  let component: OptionsDebugSectionComponent;
  let fixture: ComponentFixture<OptionsDebugSectionComponent>;
  let addonServiceSpy: any;
  let wowUpServiceSpy: any;
  let sessionService: any;
  let metricsApiServiceSpy: any;

  beforeEach(async () => {
    addonServiceSpy = jasmine.createSpyObj(AddonService, ["logDebugData"]);
    wowUpServiceSpy = jasmine.createSpyObj(WowUpService, ["showLogsFolder"]);
    sessionService = jasmine.createSpyObj("SessionService", [""], {});
    metricsApiServiceSpy = jasmine.createSpyObj("MetricsApiService", ["getSnapshot", "logSnapshot"]);
    metricsApiServiceSpy.logSnapshot.and.returnValue(Promise.resolve(SNAPSHOT));

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
            { provide: MetricsApiService, useValue: metricsApiServiceSpy },
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

  it("Should log the process metrics and show them busiest first", fakeAsync(() => {
    const button = fixture.debugElement.nativeElement.querySelector("#log-metrics-btn");
    button.click();
    tick();

    expect(metricsApiServiceSpy.logSnapshot).toHaveBeenCalled();
    expect(component.metricsProcesses.map((p) => p.pid)).toEqual([2, 1]);
    expect(component.metricsWindowState).toEqual("focused");
  }));
});
