/* eslint-disable @typescript-eslint/unbound-method */
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { httpLoaderFactory } from "../../../app.module";
import { AddonInstallState } from "../../../models/wowup/addon-install-state";
import { MatModule } from "../../../modules/mat-module";
import { AddonService } from "../../../services/addons/addon.service";
import { IconService } from "../../../services/icons/icon.service";
import { SessionService } from "../../../services/session/session.service";
import { WarcraftInstallationService } from "../../../services/warcraft/warcraft-installation.service";
import { ProtocolSearchResult } from "wowup-lib-core";

import {
  InstallFromProtocolDialogComponent,
  InstallFromProtocolDialogComponentData,
} from "./install-from-protocol-dialog.component";

describe("InstallFromProtocolDialogComponent", () => {
  let component: InstallFromProtocolDialogComponent;
  let fixture: ComponentFixture<InstallFromProtocolDialogComponent>;
  let addonService: jasmine.SpyObj<AddonService>;
  let sessionService: jasmine.SpyObj<SessionService>;
  let warcraftInstallationService: WarcraftInstallationService;
  let dialogModel: InstallFromProtocolDialogComponentData;

  beforeEach(async () => {
    addonService = jasmine.createSpyObj(
      "AddonService",
      {
        getAddonForProtocol: () => Promise.resolve(undefined),
        installPotentialAddon: Promise.resolve(),
      },
      {},
    );

    sessionService = jasmine.createSpyObj("SessionService", ["notifyTargetFileInstallComplete"], {});

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

  describe("onInstall", () => {
    let finishInstall: () => void;

    beforeEach(() => {
      component.addon = { name: "Spoken: English", files: [] } as unknown as ProtocolSearchResult;
      component.validWowInstallations = [{ id: "install-1" }, { id: "install-2" }] as any;
      component.installations.setValue(["install-1", "install-2"]);

      // Each install reports the addon itself as done, then keeps waiting on its dependencies
      const pendingDependencies = new Promise<void>((resolve) => (finishInstall = resolve));
      addonService.installPotentialAddon.and.callFake((_addon, _installation, onUpdate) => {
        onUpdate?.(AddonInstallState.Downloading, 25);
        onUpdate?.(AddonInstallState.Complete, 100);
        return pendingDependencies;
      });
    });

    it("should be complete once the addon is installed, without waiting on its dependencies", async () => {
      const done = component.onInstall();
      await new Promise((r) => setTimeout(r));

      expect(component.isComplete).toBeTrue();
      expect(component.isInstalling).toBeFalse();
      expect(component.installProgress).toEqual(100);

      finishInstall();
      await done;
      expect(sessionService.notifyTargetFileInstallComplete).toHaveBeenCalledTimes(2);
    });

    it("should start every selected installation right away", async () => {
      const done = component.onInstall();
      await new Promise((r) => setTimeout(r));

      expect(addonService.installPotentialAddon).toHaveBeenCalledTimes(2);
      finishInstall();
      await done;
    });

    it("should not count a failed install as done", async () => {
      addonService.installPotentialAddon.and.callFake((_addon, _installation, onUpdate) => {
        onUpdate?.(AddonInstallState.Error, 100);
        return Promise.reject(new Error("bad zip"));
      });

      await component.onInstall();

      expect(component.isComplete).toBeFalse();
      expect(component.error).not.toEqual("");
    });
  });
});
