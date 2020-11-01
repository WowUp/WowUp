import { Component, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { MatSelectChange } from "@angular/material/select";
import { MatSlideToggleChange } from "@angular/material/slide-toggle";
import { TranslateService } from "@ngx-translate/core";
import { ElectronService } from "app/services";
import { AnalyticsService } from "app/services/analytics/analytics.service";
import { WowUpService } from "app/services/wowup/wowup.service";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";

@Component({
  selector: "app-options-app-section",
  templateUrl: "./options-app-section.component.html",
  styleUrls: ["./options-app-section.component.scss"],
})
export class OptionsAppSectionComponent implements OnInit {
  public collapseToTray = false;
  public minimizeOnCloseDescription: string = "";
  public startMinimized = false;
  public startWithSystem = false;
  public telemetryEnabled = false;
  public useHardwareAcceleration = true;
  public setCurrentLanguage: string = "";
  public languages: string[] = [];

  constructor(
    private _analyticsService: AnalyticsService,
    private _dialog: MatDialog,
    private _electronService: ElectronService,
    private _translateService: TranslateService,
    public wowupService: WowUpService
  ) {}

  ngOnInit(): void {
    this._analyticsService.telemetryEnabled$.subscribe((enabled) => {
      this.telemetryEnabled = enabled;
    });

    const minimizeOnCloseKey = this._electronService.isWin
      ? "PAGES.OPTIONS.APPLICATION.MINIMIZE_ON_CLOSE_DESCRIPTION_WINDOWS"
      : "PAGES.OPTIONS.APPLICATION.MINIMIZE_ON_CLOSE_DESCRIPTION_MAC";

    this._translateService
      .get(minimizeOnCloseKey)
      .subscribe((translatedStr) => {
        this.minimizeOnCloseDescription = translatedStr;
      });

    this.telemetryEnabled = this._analyticsService.telemetryEnabled;
    this.collapseToTray = this.wowupService.collapseToTray;
    this.useHardwareAcceleration = this.wowupService.useHardwareAcceleration;
    this.startWithSystem = this.wowupService.startWithSystem;
    this.startMinimized = this.wowupService.startMinimized;
    this.setCurrentLanguage = this.wowupService.setCurrentLanguage;
    this.languages = this._translateService.getLangs();
  }

  onEnableSystemNotifications = (evt: MatSlideToggleChange) => {
    this.wowupService.enableSystemNotifications = evt.checked;
  };

  onTelemetryChange = (evt: MatSlideToggleChange) => {
    this._analyticsService.telemetryEnabled = evt.checked;
  };

  onCollapseChange = (evt: MatSlideToggleChange) => {
    this.wowupService.collapseToTray = evt.checked;
  };

  onStartWithSystemChange = (evt: MatSlideToggleChange) => {
    this.wowupService.startWithSystem = evt.checked;
    if (!evt.checked) {
      this.startMinimized = false;
    } else {
      this.startMinimized = this.wowupService.startMinimized;
    }
  };

  onStartMinimizedChange = (evt: MatSlideToggleChange) => {
    this.wowupService.startMinimized = evt.checked;
  };

  onUseHardwareAccelerationChange = (evt: MatSlideToggleChange) => {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant(
          "PAGES.OPTIONS.APPLICATION.USE_HARDWARE_ACCELERATION_CONFIRMATION_LABEL"
        ),
        message: this._translateService.instant(
          evt.checked
            ? "PAGES.OPTIONS.APPLICATION.USE_HARDWARE_ACCELERATION_ENABLE_CONFIRMATION_DESCRIPTION"
            : "PAGES.OPTIONS.APPLICATION.USE_HARDWARE_ACCELERATION_DISABLE_CONFIRMATION_DESCRIPTION"
        ),
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        evt.source.checked = !evt.source.checked;
        return;
      }

      this.wowupService.useHardwareAcceleration = evt.checked;
      this._electronService.restartApplication();
    });
  };

  onSetCurrentLanguageChange = (evt: MatSelectChange) => {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant(
          "PAGES.OPTIONS.APPLICATION.SET_LANGUAGE_CONFIRMATION_LABEL"
        ),
        message: this._translateService.instant(
          "PAGES.OPTIONS.APPLICATION.SET_LANGUAGE_CONFIRMATION_DESCRIPTION"
        ),
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        evt.value = "en";
        return;
      }

      this.wowupService.setCurrentLanguage = evt.value;
      this._electronService.restartApplication();
    });
  };
}
