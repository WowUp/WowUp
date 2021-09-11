import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { BehaviorSubject } from "rxjs";

import { HttpClient, HttpClientModule } from "@angular/common/http";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";

import { httpLoaderFactory } from "../../../app.module";
import { ElectronService } from "../../../services";
import { DialogFactory } from "../../../services/dialog/dialog.factory";
import { LinkService } from "../../../services/links/link.service";
import { SessionService } from "../../../services/session/session.service";
import { PatchNotesService } from "../../../services/wowup/patch-notes.service";
import { WowUpService } from "../../../services/wowup/wowup.service";
import { AboutComponent } from "./about.component";
import { MatModule } from "../../../modules/mat-module";

describe("AboutComponent", () => {
  let component: AboutComponent;
  let fixture: ComponentFixture<AboutComponent>;
  let wowupService: WowUpService;
  let electronServiceSpy: any;
  let sessionService: SessionService;
  let patchNotesService: PatchNotesService;
  let dialogFactory: DialogFactory;
  let linkService: any;

  beforeEach(async () => {
    wowupService = jasmine.createSpyObj("WowUpService", [""]);
    electronServiceSpy = jasmine.createSpyObj("ElectronService", [""], {
      getVersionNumber: () => Promise.resolve("2.0.0"),
    });

    sessionService = jasmine.createSpyObj("SessionService", [""], {
      selectedHomeTab$: new BehaviorSubject(1),
    });

    linkService = jasmine.createSpyObj("LinkService", [""], {});
    patchNotesService = jasmine.createSpyObj("PatchNotesService", [""], {});
    dialogFactory = jasmine.createSpyObj("DialogFactory", [""], {});

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
            { provide: LinkService, useValue: linkService },
            { provide: WowUpService, useValue: wowupService },
            { provide: ElectronService, useValue: electronServiceSpy },
            { provide: SessionService, useValue: sessionService },
            { provide: PatchNotesService, useValue: patchNotesService },
            { provide: DialogFactory, useValue: dialogFactory },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AboutComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
