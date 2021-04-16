import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { BehaviorSubject } from "rxjs";

import { HttpClient, HttpClientModule } from "@angular/common/http";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";

import { httpLoaderFactory } from "../../app.module";
import { MatModule } from "../../mat-module";
import { ElectronService } from "../../services";
import { SessionService } from "../../services/session/session.service";
import { PatchNotesService } from "../../services/wowup/patch-notes.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { AboutComponent } from "./about.component";

describe("AboutComponent", () => {
  let component: AboutComponent;
  let fixture: ComponentFixture<AboutComponent>;
  let electronService: ElectronService;
  let wowUpService: WowUpService;
  let electronServiceSpy: any;
  let wowUpServiceSpy: any;
  let sessionService: SessionService;
  let patchNotesService: PatchNotesService;

  beforeEach(async () => {
    wowUpServiceSpy = jasmine.createSpyObj("WowUpService", {
      getThemeLogoPath: () => "",
    });
    electronServiceSpy = jasmine.createSpyObj("ElectronService", [], {
      getVersionNumber: () => Promise.resolve("2.0.0"),
    });

    sessionService = jasmine.createSpyObj("SessionService", [], {
      selectedHomeTab$: new BehaviorSubject(1),
    });

    patchNotesService = jasmine.createSpyObj("PatchNotesService", [""], {});

    await TestBed.configureTestingModule({
      declarations: [AboutComponent],
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
      .overrideComponent(AboutComponent, {
        set: {
          providers: [
            { provide: WowUpService, useValue: wowUpServiceSpy },
            { provide: ElectronService, useValue: electronServiceSpy },
            { provide: SessionService, useValue: sessionService },
            { provide: PatchNotesService, useValue: patchNotesService },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AboutComponent);
    component = fixture.componentInstance;
    wowUpService = fixture.debugElement.injector.get(WowUpService);
    electronService = fixture.debugElement.injector.get(ElectronService);

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
