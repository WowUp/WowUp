import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { WowUpService } from "../../services/wowup/wowup.service";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { ElectronService } from "../../services";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { httpLoaderFactory } from "../../app.module";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { WowClientOptionsComponent } from "./wow-client-options.component";
import { BehaviorSubject } from "rxjs";
import { InstalledProduct } from "../../models/warcraft/installed-product";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { MatSelectModule } from "@angular/material/select";
import { MatMenuModule } from "@angular/material/menu";
import { MatInputModule } from "@angular/material/input";
import { MatFormFieldModule } from "@angular/material/form-field";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

describe("WowClientOptionsComponent", () => {
  let component: WowClientOptionsComponent;
  let fixture: ComponentFixture<WowClientOptionsComponent>;
  let electronService: ElectronService;
  let electronServiceSpy: any;
  let wowUpService: WowUpService;
  let wowUpServiceSpy: any;
  let warcraftService: WarcraftService;
  let warcraftServiceSpy: any;

  beforeEach(async () => {
    wowUpServiceSpy = jasmine.createSpyObj("WowUpService", {
      getDefaultAddonChannel: (clientType: WowClientType) => clientType.toString(),
      getDefaultAutoUpdate: (clientType: WowClientType) => clientType.toString(),
    })
    warcraftServiceSpy = jasmine.createSpyObj("WarcraftService", {
      getClientFolderName: (clientType: WowClientType) => clientType.toString(),
      getClientLocation: (clientType: WowClientType) => clientType.toString(),
    }, {
      products$: new BehaviorSubject<InstalledProduct[]>([]).asObservable(),
    })

    await TestBed.configureTestingModule({
      declarations: [WowClientOptionsComponent],
      imports: [
        MatMenuModule,
        MatInputModule,
        MatFormFieldModule,
        MatSelectModule,
        HttpClientModule,
        MatDialogModule,
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
        })
      ],
      providers: [
        MatDialog,
      ]
    }).overrideComponent(WowClientOptionsComponent, {
      set: {
        providers: [
          { provide: WowUpService, useValue: wowUpServiceSpy },
          { provide: ElectronService, useValue: electronServiceSpy },
          { provide: WarcraftService, useValue: warcraftServiceSpy },
        ]},
    }).compileComponents();

    fixture = TestBed.createComponent(WowClientOptionsComponent);
    component = fixture.componentInstance;
    wowUpService = fixture.debugElement.injector.get(WowUpService);
    electronService = fixture.debugElement.injector.get(ElectronService);
    warcraftService = fixture.debugElement.injector.get(WarcraftService);

    component.clientType = WowClientType.Retail;

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
