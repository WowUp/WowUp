import { ChangeDetectorRef } from "@angular/core";
import { ComponentFixture, inject, TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { ElectronService } from "../../services/electron/electron.service";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { WowClientOptionsComponent } from "./wow-client-options.component";

describe("WowClientOptionsComponent", () => {
  let component: WowClientOptionsComponent;
  let fixture: ComponentFixture<WowClientOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [WowClientOptionsComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WowClientOptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    inject(
      [
        MatDialog,
        ElectronService,
        WarcraftService,
        WowUpService,
        ChangeDetectorRef,
      ],
      (
        matDialog: MatDialog,
        electronService: ElectronService,
        warcraftService: WarcraftService,
        wowupService: WowUpService,
        chageRef: ChangeDetectorRef
      ) => {
        const instance = new WowClientOptionsComponent(
          matDialog,
          electronService,
          warcraftService,
          wowupService,
          chageRef
        );
        expect(instance).toBeTruthy();
      }
    );
  });
});
