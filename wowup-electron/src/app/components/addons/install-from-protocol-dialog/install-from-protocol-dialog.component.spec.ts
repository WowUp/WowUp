import { HttpClient, HttpClientModule } from "@angular/common/http";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { httpLoaderFactory } from "../../../app.module";
import { MatModule } from "../../../modules/mat-module";
import { AddonService } from "../../../services/addons/addon.service";
import { IconService } from "../../../services/icons/icon.service";
import { SessionService } from "../../../services/session/session.service";
import { WarcraftInstallationService } from "../../../services/warcraft/warcraft-installation.service";

import {
  InstallFromProtocolDialogComponent,
  InstallFromProtocolDialogComponentData,
} from "./install-from-protocol-dialog.component";

describe("InstallFromProtocolDialogComponent", () => {
  let component: InstallFromProtocolDialogComponent;
  let fixture: ComponentFixture<InstallFromProtocolDialogComponent>;
  let addonService: AddonService;
  let sessionService: SessionService;
  let warcraftInstallationService: WarcraftInstallationService;
  let dialogModel: InstallFromProtocolDialogComponentData;

  beforeEach(async () => {
    addonService = jasmine.createSpyObj(
      "AddonService",
      {
        getAddonForProtocol: () => Promise.resolve(undefined),
      },
      {},
    );

    sessionService = jasmine.createSpyObj("SessionService", [""], {});

    warcraftInstallationService = jasmine.createSpyObj("WarcraftInstallationService", [""], {});

    dialogModel = { protocol: "" };

    const testBed = TestBed.configureTestingModule({
      declarations: [InstallFromProtocolDialogComponent],
      imports: [
        MatModule,
        HttpClientModule,
        NoopAnimationsModule,
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
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [{ provide: MAT_DIALOG_DATA, useValue: dialogModel }],
    }).overrideComponent(InstallFromProtocolDialogComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: {} },
          { provide: AddonService, useValue: addonService },
          { provide: SessionService, useValue: sessionService },
          { provide: WarcraftInstallationService, useValue: warcraftInstallationService },
          { provide: IconService },
        ],
      },
    });

    await testBed.compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(InstallFromProtocolDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
