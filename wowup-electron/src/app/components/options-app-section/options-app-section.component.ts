import { from, of } from "rxjs";
import { catchError, map, switchMap } from "rxjs/operators";

import { ChangeDetectorRef, Component, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { MatSelectChange } from "@angular/material/select";
import { MatSlideToggleChange } from "@angular/material/slide-toggle";
import { TranslateService } from "@ngx-translate/core";

import {
  ALLIANCE_LIGHT_THEME,
  ALLIANCE_THEME,
  APP_PROTOCOL_NAME,
  CURSE_PROTOCOL_NAME,
  DEFAULT_LIGHT_THEME,
  DEFAULT_THEME,
  HORDE_LIGHT_THEME,
  HORDE_THEME,
} from "../../../common/constants";
import { ThemeGroup } from "../../models/wowup/theme";
import { ElectronService } from "../../services";
import { AnalyticsService } from "../../services/analytics/analytics.service";
import { DialogFactory } from "../../services/dialog/dialog.factory";
import { SessionService } from "../../services/session/session.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { ZOOM_SCALE } from "../../utils/zoom.utils";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";
import { ZoomService } from "../../services/zoom/zoom.service";

interface LocaleListItem {
  localeId: string;
  label: string;
}

interface TabListItem {
  val: string,
  label: string;
}

@Component({
  selector: "app-options-app-section",
  templateUrl: "./options-app-section.component.html",
  styleUrls: ["./options-app-section.component.scss"],
})
export class OptionsAppSectionComponent implements OnInit {
  public readonly curseProtocolName = CURSE_PROTOCOL_NAME;
  public readonly wowupProtocolName = APP_PROTOCOL_NAME;

  public collapseToTray = false;
  public minimizeOnCloseDescription = "";
  public startMinimized = false;
  public startWithSystem = false;
  public protocolRegistered = false;
  public useSymlinkMode = false;
  public telemetryEnabled = false;
  public useHardwareAcceleration = true;
  public currentLanguage = "";
  public zoomScale = ZOOM_SCALE;
  public currentScale = 1;
  public currentDefaultDetailsTabSelection = "";
  public currentDetailsTabSelection = "";
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

  public detailsTabSelections: TabListItem[] = [
    { val: "last_used_tab", label: "Last used tab" },
    { val: "description", label: "Description" },
    { val: "changelog", label: "Changelog" }
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

  public curseforgeProtocolHandled$ = from(this.electronService.isDefaultProtocolClient(CURSE_PROTOCOL_NAME));
  public wowupProtocolHandled$ = from(this.electronService.isDefaultProtocolClient(APP_PROTOCOL_NAME));

  public constructor(
    private _analyticsService: AnalyticsService,
    private _dialog: MatDialog,
    private _dialogFactory: DialogFactory,
    private _translateService: TranslateService,
    private _cdRef: ChangeDetectorRef,
    private _zoomService: ZoomService,
    public electronService: ElectronService,
    public sessionService: SessionService,
    public wowupService: WowUpService
  ) {}

  public ngOnInit(): void {
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
    this.useSymlinkMode = this.wowupService.useSymlinkMode;
    this.currentDefaultDetailsTabSelection = this.sessionService.getDefaultSelectedDetailsTab();

    this.initScale().catch((e) => console.error(e));

    this._zoomService.zoomFactor$.subscribe((zoomFactor) => {
      this.currentScale = zoomFactor;
      this._cdRef.detectChanges();
    });

    this.electronService
      .isDefaultProtocolClient(APP_PROTOCOL_NAME)
      .then((isDefault) => {
        this.protocolRegistered = isDefault;
      })
      .catch((e) => console.error(e));
  }

  private async initScale() {
    await this.updateScale();
    this.electronService.onRendererEvent("zoom-changed", () => {
      this.updateScale().catch((e) => console.error(e));
    });
  }

  public onEnableSystemNotifications = (evt: MatSlideToggleChange): void => {
    this.wowupService.enableSystemNotifications = evt.checked;
  };

  public onTelemetryChange = (evt: MatSlideToggleChange): void => {
    this._analyticsService.telemetryEnabled = evt.checked;
  };

  public onCollapseChange = (evt: MatSlideToggleChange): void => {
    this.wowupService.collapseToTray = evt.checked;
  };

  public onStartWithSystemChange = async (evt: MatSlideToggleChange): Promise<void> => {
    await this.wowupService.setStartWithSystem(evt.checked);
    if (!evt.checked) {
      this.startMinimized = false;
    } else {
      this.startMinimized = this.wowupService.startMinimized;
    }
  };

  public onStartMinimizedChange = async (evt: MatSlideToggleChange): Promise<void> => {
    await this.wowupService.setStartMinimized(evt.checked);
  };

  public onProtocolHandlerChange = (evt: MatSlideToggleChange, protocol: string): void => {
    // If this is already enabled and the user wants to disable it, don't prompt
    if (evt.checked === false) {
      from(this.setProtocolHandler(protocol, evt.checked))
        .pipe(
          catchError((e) => {
            console.error(e);
            return of(undefined);
          })
        )
        .subscribe();
      return;
    }

    // Prompt the user that this may affect their existing CurseForge app
    const title = this._translateService.instant("PAGES.OPTIONS.APPLICATION.USE_CURSE_PROTOCOL_CONFIRMATION_LABEL");
    const message = this._translateService.instant(
      "PAGES.OPTIONS.APPLICATION.USE_CURSE_PROTOCOL_CONFIRMATION_DESCRIPTION"
    );

    const dialogRef = this._dialogFactory.getConfirmDialog(title, message);

    dialogRef
      .afterClosed()
      .pipe(
        switchMap((result) => {
          if (!result) {
            evt.source.checked = !evt.source.checked;
            return of(undefined);
          }

          return from(this.setProtocolHandler(protocol, evt.checked));
        }),
        catchError((error) => {
          console.error(error);
          return of(undefined);
        })
      )
      .subscribe();
  };

  public onUseHardwareAccelerationChange = (evt: MatSlideToggleChange): void => {
    const title = this._translateService.instant(
      "PAGES.OPTIONS.APPLICATION.USE_HARDWARE_ACCELERATION_CONFIRMATION_LABEL"
    );
    const message = this._translateService.instant(
      evt.checked
        ? "PAGES.OPTIONS.APPLICATION.USE_HARDWARE_ACCELERATION_ENABLE_CONFIRMATION_DESCRIPTION"
        : "PAGES.OPTIONS.APPLICATION.USE_HARDWARE_ACCELERATION_DISABLE_CONFIRMATION_DESCRIPTION"
    );

    const dialogRef = this._dialogFactory.getConfirmDialog(title, message);

    dialogRef
      .afterClosed()
      .pipe(
        switchMap((result) => {
          if (!result) {
            evt.source.checked = !evt.source.checked;
            return of(undefined);
          }

          this.wowupService.useHardwareAcceleration = evt.checked;
          return from(this.electronService.restartApplication());
        }),
        catchError((error) => {
          console.error(error);
          return of(undefined);
        })
      )
      .subscribe();
  };

  public onSymlinkModeChange = (evt: MatSlideToggleChange): void => {
    if (evt.checked === false) {
      this.wowupService.useSymlinkMode = false;
      return;
    }

    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant("PAGES.OPTIONS.APPLICATION.USE_SYMLINK_SUPPORT_CONFIRMATION_LABEL"),
        message: this._translateService.instant(
          "PAGES.OPTIONS.APPLICATION.USE_SYMLINK_SUPPORT_CONFIRMATION_DESCRIPTION"
        ),
      },
    });

    dialogRef
      .afterClosed()
      .pipe(
        map((result) => {
          if (!result) {
            evt.source.checked = !evt.source.checked;
            return of(undefined);
          }

          this.wowupService.useSymlinkMode = evt.checked;
        }),
        catchError((error) => {
          console.error(error);
          return of(undefined);
        })
      )
      .subscribe();
  };

  public onCurrentLanguageChange = (evt: MatSelectChange): void => {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant("PAGES.OPTIONS.APPLICATION.SET_LANGUAGE_CONFIRMATION_LABEL"),
        message: this._translateService.instant("PAGES.OPTIONS.APPLICATION.SET_LANGUAGE_CONFIRMATION_DESCRIPTION"),
      },
    });

    dialogRef
      .afterClosed()
      .pipe(
        switchMap((result) => {
          if (!result) {
            evt.source.value = this.wowupService.currentLanguage;
            return of(undefined);
          }

          this.wowupService.currentLanguage = evt.value;
          return from(this.electronService.restartApplication());
        }),
        catchError((error) => {
          console.error(error);
          return of(undefined);
        })
      )
      .subscribe();
  };

  public onScaleChange = async (evt: MatSelectChange): Promise<void> => {
    const newScale = evt.value;
    await this._zoomService.setZoomFactor(newScale);
    this.currentScale = newScale;
  };

  public onCurrentDefaultDetailsTabSelectionChange = (evt: MatSelectChange): void => {
    this.sessionService.setDefaultSelectedDetailsTab(evt.value);
    if (evt.value != "last_used_tab")
    {
      this.sessionService.setSelectedDetailsTab(evt.value);
    }
  };

  private async updateScale() {
    this.currentScale = await this._zoomService.getZoomFactor();
  }

  private setProtocolHandler(protocol: string, enabled: boolean): Promise<boolean> {
    if (enabled) {
      return this.electronService.setAsDefaultProtocolClient(protocol);
    } else {
      return this.electronService.removeAsDefaultProtocolClient(protocol);
    }
  }
}
