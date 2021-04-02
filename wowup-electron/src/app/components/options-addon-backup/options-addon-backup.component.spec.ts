import { HttpClientModule } from "@angular/common/http";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormsModule } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { MatModule } from "../../mat-module";
import { WarcraftInstallationService } from "../../services/warcraft/warcraft-installation.service";
import { WowUpBackupAddonService } from "../../services/wowup/wowup-backup-addon.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { createTranslateModule } from "../../utils/test.utils";
import { OptionsAddonBackupComponent } from "./options-addon-backup.component";

describe("OptionsAddonBackupComponent", () => {
  let component: OptionsAddonBackupComponent;
  let fixture: ComponentFixture<OptionsAddonBackupComponent>;
  let wowUpService: WowUpService;
  let wowUpBackupAddonService: WowUpBackupAddonService;
  let warcraftInstallationService: WarcraftInstallationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OptionsAddonBackupComponent],
      providers: [
        MatDialog,

        { provide: WowUpService, useValue: wowUpService },
        { provide: WowUpBackupAddonService, useValue: wowUpBackupAddonService },
        { provide: WarcraftInstallationService, useValue: warcraftInstallationService },
      ],
      imports: [HttpClientModule, FormsModule, MatModule, BrowserAnimationsModule, createTranslateModule()],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(OptionsAddonBackupComponent);
    component = fixture.componentInstance;

    wowUpService = fixture.debugElement.injector.get(WowUpService);
    wowUpBackupAddonService = fixture.debugElement.injector.get(WowUpBackupAddonService);
    warcraftInstallationService = fixture.debugElement.injector.get(WarcraftInstallationService);
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
