import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";

import { HttpClient, HttpClientModule } from "@angular/common/http";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";

import { httpLoaderFactory } from "../../app.module";
import { MatModule } from "../../mat-module";
import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { WowClientOptionsComponent } from "./wow-client-options.component";
import { FormsModule } from "@angular/forms";
import { overrideIconModule } from "../../tests/mock-mat-icon";
import { WarcraftInstallationService } from "../../services/warcraft/warcraft-installation.service";

describe("WowClientOptionsComponent", () => {
  let component: WowClientOptionsComponent;
  let fixture: ComponentFixture<WowClientOptionsComponent>;
  let warcraftInstallationService: WarcraftInstallationService;

  beforeEach(async () => {
    warcraftInstallationService = jasmine.createSpyObj("warcraftInstallationService", ["getWowInstallations"], {
      getWowInstallation: () => {
        return {
          clientType: WowClientType.Beta,
        };
      },
    });

    let testBed = TestBed.configureTestingModule({
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
    });
    testBed = overrideIconModule(testBed).overrideComponent(WowClientOptionsComponent, {
      set: {
        providers: [{ provide: WarcraftInstallationService, useValue: warcraftInstallationService }],
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
