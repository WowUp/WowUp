import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { WowUpService } from "../../services/wowup/wowup.service";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { httpLoaderFactory } from "../../app.module";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { OptionsWowSectionComponent } from "./options-wow-section.component";
import { WowUpReleaseChannelType } from "../../models/wowup/wowup-release-channel-type";

describe("OptionsWowSectionComponent", () => {
  let component: OptionsWowSectionComponent;
  let fixture: ComponentFixture<OptionsWowSectionComponent>;
  let wowUpService: WowUpService;
  let wowUpServiceSpy: any;
  let warcraftService: WarcraftService;
  let warcraftServiceSpy: any;

  beforeEach(async () => {
    wowUpServiceSpy = jasmine.createSpyObj("WowUpService", [""], {
      wowUpReleaseChannel: WowUpReleaseChannelType.Stable,
    })

    await TestBed.configureTestingModule({
      declarations: [OptionsWowSectionComponent],
      imports: [
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
    }).overrideComponent(OptionsWowSectionComponent, {
      set: {
        providers: [
          { provide: WowUpService, useValue: wowUpServiceSpy },
          { provide: WarcraftService, useValue: warcraftServiceSpy },
        ]},
    }).compileComponents();

    fixture = TestBed.createComponent(OptionsWowSectionComponent);
    component = fixture.componentInstance;
    wowUpService = fixture.debugElement.injector.get(WowUpService);
    warcraftService = fixture.debugElement.injector.get(WarcraftService);

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
