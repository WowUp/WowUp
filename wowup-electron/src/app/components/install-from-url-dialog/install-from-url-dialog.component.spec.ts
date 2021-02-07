import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";

import { HttpClient, HttpClientModule } from "@angular/common/http";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatDialogRef } from "@angular/material/dialog";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";

import { httpLoaderFactory } from "../../app.module";
import { MatModule } from "../../mat-module";
import { DownloadCountPipe } from "../../pipes/download-count.pipe";
import { AddonService } from "../../services/addons/addon.service";
import { SessionService } from "../../services/session/session.service";
import { InstallFromUrlDialogComponent } from "./install-from-url-dialog.component";
import { IconService } from "../../services/icons/icon.service";
import { overrideIconModule } from "../../tests/mock-mat-icon";

describe("InstallFromUrlDialogComponent", () => {
  console.log("InstallFromUrlDialogComponent");
  let component: InstallFromUrlDialogComponent;
  let fixture: ComponentFixture<InstallFromUrlDialogComponent>;
  let sessionService: SessionService;
  let sessionServiceSpy: any;
  let addonService: AddonService;
  let addonServiceSpy: any;

  beforeEach(async () => {
    let testBed = TestBed.configureTestingModule({
      declarations: [InstallFromUrlDialogComponent],
      imports: [
        MatModule,
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
    });

    testBed = overrideIconModule(testBed).overrideComponent(InstallFromUrlDialogComponent, {
      set: {
        providers: [
          DownloadCountPipe,
          { provide: MatDialogRef, useValue: {} },
          { provide: AddonService, useValue: addonServiceSpy },
          { provide: SessionService, useValue: sessionServiceSpy },
          { provide: IconService },
        ],
      },
    });

    await testBed.compileComponents();

    fixture = TestBed.createComponent(InstallFromUrlDialogComponent);
    component = fixture.componentInstance;
    addonService = fixture.debugElement.injector.get(AddonService);
    sessionService = fixture.debugElement.injector.get(SessionService);
    const icons = fixture.debugElement.injector.get(IconService);

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
