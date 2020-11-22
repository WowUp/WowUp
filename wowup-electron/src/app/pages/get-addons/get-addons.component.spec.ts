import { ComponentFixture, TestBed } from "@angular/core/testing";
import { GetAddonsComponent } from "./get-addons.component";
import { AddonService } from "../../services/addons/addon.service";
import { SessionService } from "../../services/session/session.service";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { WowUpService } from "../../services/wowup/wowup.service";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { ElectronService } from "../../services";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { httpLoaderFactory } from "../../app.module";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { OverlayModule } from "@angular/cdk/overlay";
import { BehaviorSubject } from "rxjs";
import { MatMenuModule } from "@angular/material/menu";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { MatInputModule } from "@angular/material/input";
import { MatFormFieldModule } from "@angular/material/form-field";

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
    })
    sessionServiceSpy = jasmine.createSpyObj("SessionService", [""], {
      selectedHomeTab$: new BehaviorSubject(0).asObservable(),
    })
    warcraftServiceSpy = jasmine.createSpyObj("WarcraftService", [""], {
      installedClientTypesSelectItems$: new BehaviorSubject<WowClientType[] | undefined>(undefined).asObservable(),
    })
    electronServiceSpy = jasmine.createSpyObj("ElectronService", [""], {
      isWin : false,
      isLinux : true,
      isMax: false,
    });

    await TestBed.configureTestingModule({
      declarations: [GetAddonsComponent],
      imports: [
        MatMenuModule,
        OverlayModule,
        HttpClientModule,
        MatDialogModule,
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
      providers: [
        MatDialog,
      ]
    }).overrideComponent(GetAddonsComponent, {
      set: {
        providers: [
          { provide: AddonService, useValue: addonServiceSpy },
          { provide: WowUpService, useValue: wowUpServiceSpy },
          { provide: ElectronService, useValue: electronServiceSpy },
          { provide: SessionService, useValue: sessionServiceSpy },
          { provide: WarcraftService, useValue: warcraftServiceSpy },
        ]},
    }).compileComponents();

    fixture = TestBed.createComponent(GetAddonsComponent);
    component = fixture.componentInstance;
    addonService = fixture.debugElement.injector.get(AddonService);
    wowUpService = fixture.debugElement.injector.get(WowUpService);
    electronService = fixture.debugElement.injector.get(ElectronService);
    sessionService = fixture.debugElement.injector.get(SessionService);
    warcraftService = fixture.debugElement.injector.get(WarcraftService);

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
