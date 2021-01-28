import { ChangeDetectorRef, Component, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { MatSelectChange } from "@angular/material/select";
import { MatSlideToggleChange } from "@angular/material/slide-toggle";
import { TranslateService } from "@ngx-translate/core";
import { ElectronService } from "../../services";
import { AnalyticsService } from "../../services/analytics/analytics.service";
import { SessionService } from "../../services/session/session.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { ThemeGroup } from "../../models/wowup/theme";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";
import {
  ALLIANCE_LIGHT_THEME,
  ALLIANCE_THEME,
  DEFAULT_LIGHT_THEME,
  DEFAULT_THEME,
  HORDE_LIGHT_THEME,
  HORDE_THEME,
} from "../../../common/constants";
import { ZOOM_SCALE } from "../../utils/zoom.utils";

interface LocaleListItem {
  localeId: string;
  label: string;
}

@Component({
  selector: "app-options-app-section",
  templateUrl: "./options-app-section.component.html",
  styleUrls: ["./options-app-section.component.scss"],
})
export class OptionsAppSectionComponent implements OnInit {
  public collapseToTray = false;
  public minimizeOnCloseDescription = "";
  public startMinimized = false;
  public startWithSystem = false;
  public telemetryEnabled = false;
  public useHardwareAcceleration = true;
  public currentLanguage = "";
  public zoomScale = ZOOM_SCALE;
  public currentScale = 1;
  public languages: LocaleListItem[] = [
    { localeId: "en", label: "English" },
    { localeId: "cs", label: "Čestina" },
    { localeId: "de", label: "Deutsch" },
    { localeId: "es", label: "Español" },
    { localeId: "fr", label: "Français" },
    { localeId: "it", label: "Italiano" },
    { localeId: "ko", label: "한국어" },
    { localeId: "nb", label: "Norsk Bokmål" },
    { localeId: "pt", label: "Português" },
    { localeId: "ru", label: "русский" },
    { localeId: "zh", label: "简体中文" },
    { localeId: "zh-TW", label: "繁體中文" },
  ];

  public themeGroups: ThemeGroup[] = [
    {
      name: "APP.THEME.GROUP_DARK",
      themes: [
        { display: "APP.THEME.DEFAULT", class: DEFAULT_THEME },
        { display: "APP.THEME.ALLIANCE", class: ALLIANCE_THEME },
        { display: "APP.THEME.HORDE", class: HORDE_THEME },
      ],
    },
    {
      name: "APP.THEME.GROUP_LIGHT",
      themes: [
        { display: "APP.THEME.DEFAULT", class: DEFAULT_LIGHT_THEME },
        { display: "APP.THEME.ALLIANCE", class: ALLIANCE_LIGHT_THEME },
        { display: "APP.THEME.HORDE", class: HORDE_LIGHT_THEME },
      ],
    },
  ];

  constructor(
    private _analyticsService: AnalyticsService,
    private _dialog: MatDialog,
    private _translateService: TranslateService,
    private _cdRef: ChangeDetectorRef,
    public electronService: ElectronService,
    public sessionService: SessionService,
    public wowupService: WowUpService
  ) {}

  ngOnInit(): void {
    this._analyticsService.telemetryEnabled$.subscribe((enabled) => {
      this.telemetryEnabled = enabled;
    });

    const minimizeOnCloseKey = this.electronService.isWin
      ? "PAGES.OPTIONS.APPLICATION.MINIMIZE_ON_CLOSE_DESCRIPTION_WINDOWS"
      : "PAGES.OPTIONS.APPLICATION.MINIMIZE_ON_CLOSE_DESCRIPTION_MAC";

    this._translateService.get(minimizeOnCloseKey).subscribe((translatedStr) => {
      this.minimizeOnCloseDescription = translatedStr;
    });

    this.telemetryEnabled = this._analyticsService.telemetryEnabled;
    this.collapseToTray = this.wowupService.collapseToTray;
    this.useHardwareAcceleration = this.wowupService.useHardwareAcceleration;
    this.startWithSystem = this.wowupService.getStartWithSystem();
    this.startMinimized = this.wowupService.startMinimized;
    this.currentLanguage = this.wowupService.currentLanguage;

    this.initScale().catch((e) => console.error(e));

    this.electronService.zoomFactor$.subscribe((zoomFactor) => {
      this.currentScale = zoomFactor;
      this._cdRef.detectChanges();
    });
  }

  private async initScale() {
    await this.updateScale();
    this.electronService.onRendererEvent("zoom-changed", () => {
      this.updateScale().catch((e) => console.error(e));
    });
  }

  onEnableSystemNotifications = (evt: MatSlideToggleChange): void => {
    this.wowupService.enableSystemNotifications = evt.checked;
  };

  onTelemetryChange = (evt: MatSlideToggleChange): void => {
    this._analyticsService.telemetryEnabled = evt.checked;
  };

  onCollapseChange = (evt: MatSlideToggleChange): void => {
    this.wowupService.collapseToTray = evt.checked;
  };

  onStartWithSystemChange = async (evt: MatSlideToggleChange): Promise<void> => {
    await this.wowupService.setStartWithSystem(evt.checked);
    if (!evt.checked) {
      this.startMinimized = false;
    } else {
      this.startMinimized = this.wowupService.startMinimized;
    }
  };

  onStartMinimizedChange = async (evt: MatSlideToggleChange): Promise<void> => {
    await this.wowupService.setStartMinimized(evt.checked);
  };

  onUseHardwareAccelerationChange = (evt: MatSlideToggleChange): void => {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant("PAGES.OPTIONS.APPLICATION.USE_HARDWARE_ACCELERATION_CONFIRMATION_LABEL"),
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
      this.electronService.restartApplication();
    });
  };

  onCurrentLanguageChange = (evt: MatSelectChange): void => {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant("PAGES.OPTIONS.APPLICATION.SET_LANGUAGE_CONFIRMATION_LABEL"),
        message: this._translateService.instant("PAGES.OPTIONS.APPLICATION.SET_LANGUAGE_CONFIRMATION_DESCRIPTION"),
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        evt.source.value = this.wowupService.currentLanguage;
        return;
      }

      this.wowupService.currentLanguage = evt.value;
      this.electronService.restartApplication();
    });
  };

  public onScaleChange = async (evt: MatSelectChange): Promise<void> => {
    const newScale = evt.value;
    await this.electronService.setZoomFactor(newScale);
    this.currentScale = newScale;
  };

  private async updateScale() {
    this.currentScale = await this.electronService.getZoomFactor();
  }
}
