import { ComponentFixture, TestBed } from "@angular/core/testing";
import { AddonService, } from "../../services/addons/addon.service";
import { SessionService } from "../../services/session/session.service";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { httpLoaderFactory } from "../../app.module";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { InstallFromUrlDialogComponent } from "./install-from-url-dialog.component";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { DownloadCountPipe } from "../../pipes/download-count.pipe";

describe("InstallFromUrlDialogComponent", () => {
  let component: InstallFromUrlDialogComponent;
  let fixture: ComponentFixture<InstallFromUrlDialogComponent>;
  let sessionService: SessionService;
  let sessionServiceSpy: any;
  let addonService: AddonService;
  let addonServiceSpy: any;

  beforeEach(async () => {
    // addonServiceSpy = jasmine.createSpyObj("AddonService", [""], {
    //   scanUpdate$: new BehaviorSubject<ScanUpdate>({ type: ScanUpdateType.Unknown }).asObservable(),
    // })


    await TestBed.configureTestingModule({
      declarations: [InstallFromUrlDialogComponent],
      imports: [
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
    }).overrideComponent(InstallFromUrlDialogComponent, {
      set: {
        providers: [
          DownloadCountPipe,
          { provide: MatDialogRef, useValue: {} },
          { provide: AddonService, useValue: addonServiceSpy },
          { provide: SessionService, useValue: sessionServiceSpy },
        ]},
    }).compileComponents();

    fixture = TestBed.createComponent(InstallFromUrlDialogComponent);
    component = fixture.componentInstance;
    addonService = fixture.debugElement.injector.get(AddonService);
    sessionService = fixture.debugElement.injector.get(SessionService);

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
