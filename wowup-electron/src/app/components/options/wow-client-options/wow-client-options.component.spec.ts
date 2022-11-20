import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";

import { HttpClient, HttpClientModule } from "@angular/common/http";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";

import { httpLoaderFactory } from "../../../app.module";
import { WowClientOptionsComponent } from "./wow-client-options.component";
import { FormsModule } from "@angular/forms";
import { WarcraftInstallationService } from "../../../services/warcraft/warcraft-installation.service";
import { WarcraftService } from "../../../services/warcraft/warcraft.service";
import { mockPreload } from "../../../tests/test-helpers";
import { SessionService } from "../../../services/session/session.service";
import { BehaviorSubject, Observable } from "rxjs";
import { MatModule } from "../../../modules/mat-module";
import { WowClientType } from "wowup-lib-core";

describe("WowClientOptionsComponent", () => {
  let component: WowClientOptionsComponent;
  let fixture: ComponentFixture<WowClientOptionsComponent>;
  let warcraftInstallationService: WarcraftInstallationService;
  let warcraftService: WarcraftService;
  let sessionService: any;

  beforeEach(async () => {
    mockPreload();

    warcraftInstallationService = jasmine.createSpyObj("WarcraftInstallationService", ["getWowInstallations"], {
      wowInstallations$: new BehaviorSubject([]),
      getWowInstallation: () => {
        return {
          clientType: WowClientType.Beta,
        };
      },
    });

    warcraftService = jasmine.createSpyObj("WarcraftService", ["getExecutableName"], {});
    sessionService = jasmine.createSpyObj("SessionService", [""], {
      editingWowInstallationId$: new Observable(),
    });

    const testBed = TestBed.configureTestingModule({
      declarations: [WowClientOptionsComponent],
      imports: [
        MatModule,
        FormsModule,
        HttpClientModule,
        BrowserAnimationsModule,
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
      providers: [MatDialog],
    }).overrideComponent(WowClientOptionsComponent, {
      set: {
        providers: [
          { provide: WarcraftInstallationService, useValue: warcraftInstallationService },
          { provide: WarcraftService, useValue: warcraftService },
          { provide: SessionService, useValue: sessionService },
        ],
      },
    });
    await testBed.compileComponents();
    fixture = TestBed.createComponent(WowClientOptionsComponent);
    component = fixture.componentInstance;
    component.installationId = "1";
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
