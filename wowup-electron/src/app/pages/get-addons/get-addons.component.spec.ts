import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { BehaviorSubject } from "rxjs";

import { OverlayModule } from "@angular/cdk/overlay";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { MatIcon } from "@angular/material/icon";
import { MatIconTestingModule } from "@angular/material/icon/testing";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";

import { httpLoaderFactory } from "../../app.module";
import { MatModule } from "../../mat-module";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { ElectronService } from "../../services";
import { AddonService } from "../../services/addons/addon.service";
import { SessionService } from "../../services/session/session.service";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { GetAddonsComponent } from "./get-addons.component";

describe("GetAddonsComponent", () => {
  let component: GetAddonsComponent;
  let fixture: ComponentFixture<GetAddonsComponent>;
  let electronService: ElectronService;
  let electronServiceSpy: any;
  let wowUpService: WowUpService;
  let wowUpServiceSpy: any;
  let sessionService: SessionService;
  let sessionServiceSpy: any;
  let addonService: AddonService;
  let addonServiceSpy: any;
  let warcraftService: WarcraftService;
  let warcraftServiceSpy: any;

  beforeEach(async () => {
    wowUpServiceSpy = jasmine.createSpyObj("WowUpService", [""], {
      getAddonsHiddenColumns: [],
    });
    sessionServiceSpy = jasmine.createSpyObj("SessionService", [""], {
      selectedHomeTab$: new BehaviorSubject(0).asObservable(),
    });
    warcraftServiceSpy = jasmine.createSpyObj("WarcraftService", [""], {
      installedClientTypesSelectItems$: new BehaviorSubject<WowClientType[] | undefined>(undefined).asObservable(),
    });
    electronServiceSpy = jasmine.createSpyObj("ElectronService", [""], {
      isWin: false,
      isLinux: true,
      isMac: false,
    });

    await TestBed.configureTestingModule({
      declarations: [GetAddonsComponent, MatIcon],
      imports: [
        MatModule,
        OverlayModule,
        MatIconTestingModule,
        BrowserAnimationsModule,
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
      providers: [MatDialog],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
      .overrideComponent(GetAddonsComponent, {
        set: {
          providers: [
            { provide: AddonService, useValue: addonServiceSpy },
            { provide: WowUpService, useValue: wowUpServiceSpy },
            { provide: ElectronService, useValue: electronServiceSpy },
            { provide: SessionService, useValue: sessionServiceSpy },
            { provide: WarcraftService, useValue: warcraftServiceSpy },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(GetAddonsComponent);
    component = fixture.componentInstance;
    addonService = fixture.debugElement.injector.get(AddonService);
    wowUpService = fixture.debugElement.injector.get(WowUpService);
    electronService = fixture.debugElement.injector.get(ElectronService);
    sessionService = fixture.debugElement.injector.get(SessionService);
    warcraftService = fixture.debugElement.injector.get(WarcraftService);

    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.debugElement.nativeElement.remove();
    fixture.destroy();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
