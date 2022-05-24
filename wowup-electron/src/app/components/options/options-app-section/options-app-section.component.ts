import { BehaviorSubject, firstValueFrom, from, of } from "rxjs";
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
  DEFAULT_LIGHT_THEME,
  DEFAULT_THEME,
  HORDE_LIGHT_THEME,
  HORDE_THEME,
} from "../../../../common/constants";
import { ThemeGroup } from "../../../models/wowup/theme";
import { ElectronService } from "../../../services";
import { AnalyticsService } from "../../../services/analytics/analytics.service";
import { DialogFactory } from "../../../services/dialog/dialog.factory";
import { SessionService } from "../../../services/session/session.service";
import { WowUpService } from "../../../services/wowup/wowup.service";
import { ZOOM_SCALE } from "../../../utils/zoom.utils";
import { ConfirmDialogComponent } from "../../common/confirm-dialog/confirm-dialog.component";
import { ZoomService } from "../../../services/zoom/zoom.service";
import { AddonService } from "../../../services/addons/addon.service";
import { WowUpReleaseChannelType } from "../../../../common/wowup/wowup-release-channel-type";

interface LocaleListItem {
  localeId: string;
  label: string;
}

interface ReleaseChannelViewModel {
  value: WowUpReleaseChannelType;
  labelKey: string;
}

@Component({
  selector: "app-options-app-section",
  templateUrl: "./options-app-section.component.html",
  styleUrls: ["./options-app-section.component.scss"],
})
export class OptionsAppSectionComponent implements OnInit {
  public readonly wowupProtocolName = APP_PROTOCOL_NAME;

  public minimizeOnCloseDescription = "";
  public protocolRegistered = false;
  public zoomScale = ZOOM_SCALE;
  public currentScale = 1;
  public languages: LocaleListItem[] = [
    { localeId: "en", label: "English" },
    { localeId: "cs", label: "Čestina" },
    { localeId: "de", label: "Deutsch" },
    { localeId: "es", label: "Español" },
    { localeId: "fr", label: "Français" },
    { localeId: "it", label: "Italiano" },
    { localeId: "pl", label: "Polski" },
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

  public releaseChannels: ReleaseChannelViewModel[] = [
    { value: WowUpReleaseChannelType.Stable, labelKey: "COMMON.ENUM.ADDON_CHANNEL_TYPE.STABLE" },
    { value: WowUpReleaseChannelType.Beta, labelKey: "COMMON.ENUM.ADDON_CHANNEL_TYPE.BETA" },
  ];

  public wowupProtocolHandled$ = from(this.electronService.isDefaultProtocolClient(APP_PROTOCOL_NAME));

  private _currentTheme: string;
  public get currentTheme() {
    return this._currentTheme;
  }

  public set currentTheme(theme: string) {
    this.wowupService
      .setCurrentTheme(theme)
      .then(() => {
        this._currentTheme = theme;
      })
      .catch(console.error);
  }

  public enableSystemNotifications$ = new BehaviorSubject(false);
  public currentLanguage$ = new BehaviorSubject("");
  public useSymlinkMode$ = new BehaviorSubject(false);
  public useHardwareAcceleration$ = new BehaviorSubject(false);
  public telemetryEnabled$ = new BehaviorSubject(false);
  public collapseToTray$ = new BehaviorSubject(false);
  public enableAppBadge$ = new BehaviorSubject(false);
  public startWithSystem$ = new BehaviorSubject(false);
  public startMinimized$ = new BehaviorSubject(false);
  public currentReleaseChannel$ = new BehaviorSubject(WowUpReleaseChannelType.Stable);
  public keepAddonDetailTab$ = new BehaviorSubject(false);

  public constructor(
    private _analyticsService: AnalyticsService,
    private _dialog: MatDialog,
    private _dialogFactory: DialogFactory,
    private _translateService: TranslateService,
    private _cdRef: ChangeDetectorRef,
    private _zoomService: ZoomService,
    private _addonService: AddonService,
    public electronService: ElectronService,
    public sessionService: SessionService,
    public wowupService: WowUpService
  ) {}

  public ngOnInit(): void {
    this.currentTheme = this.sessionService.currentTheme;

    this.wowupService
      .getWowUpReleaseChannel()
      .then((channel) => {
        this.currentReleaseChannel$.next(channel);
      })
      .catch(console.error);

    this._analyticsService.telemetryEnabled$.subscribe((enabled) => {
      this.telemetryEnabled$.next(enabled);
    });

    const minimizeOnCloseKey = this.electronService.isWin
      ? "PAGES.OPTIONS.APPLICATION.MINIMIZE_ON_CLOSE_DESCRIPTION_WINDOWS"
      : "PAGES.OPTIONS.APPLICATION.MINIMIZE_ON_CLOSE_DESCRIPTION_MAC";

    this._translateService.get(minimizeOnCloseKey).subscribe((translatedStr) => {
      this.minimizeOnCloseDescription = translatedStr;
    });

    this._analyticsService
      .getTelemetryEnabled()
      .then((enabled) => {
        this.telemetryEnabled$.next(enabled);
      })
      .catch(console.error);

    this.wowupService
      .getCollapseToTray()
      .then((collapse) => {
        console.log("getCollapseToTray", collapse);
        this.collapseToTray$.next(collapse);
      })
      .catch(console.error);

    this.wowupService
      .getEnableSystemNotifications()
      .then((enabled) => {
        this.enableSystemNotifications$.next(enabled);
      })
      .catch(console.error);

    this.wowupService
      .getCurrentLanguage()
      .then((curlang) => {
        this.currentLanguage$.next(curlang);
      })
      .catch(console.error);

    this.wowupService
      .getUseSymlinkMode()
      .then((useSymlink) => {
        this.useSymlinkMode$.next(useSymlink);
      })
      .catch(console.error);

    this.wowupService
      .getUseHardwareAcceleration()
      .then((useHwAccel) => {
        this.useHardwareAcceleration$.next(useHwAccel);
      })
      .catch(console.error);

    this.wowupService
      .getEnableAppBadge()
      .then((enabled) => {
        this.enableAppBadge$.next(enabled);
      })
      .catch(console.error);

    this.wowupService
      .getStartWithSystem()
      .then((enabled) => {
        this.startWithSystem$.next(enabled);
      })
      .catch(console.error);

    this.wowupService
      .getStartMinimized()
      .then((enabled) => {
        this.startMinimized$.next(enabled);
      })
      .catch(console.error);

    this.wowupService
      .getKeepLastAddonDetailTab()
      .then((enabled) => {
        this.keepAddonDetailTab$.next(enabled);
      })
      .catch(console.error);

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
    this.wowupService
      .setEnableSystemNotifications(evt.checked)
      .then(() => {
        this.enableSystemNotifications$.next(evt.checked);
      })
      .catch(console.error);
  };

  public onToggleAppBadge = async (evt: MatSlideToggleChange): Promise<void> => {
    await this.wowupService.setEnableAppBadge(evt.checked);
    this.enableAppBadge$.next(evt.checked);

    let count = 0;
    if (evt.checked) {
      const addons = await this._addonService.getAllAddonsAvailableForUpdate();
      count = addons.length;
    }

    await this.wowupService.updateAppBadgeCount(count);
  };

  public onTelemetryChange = async (evt: MatSlideToggleChange): Promise<void> => {
    await this._analyticsService.setTelemetryEnabled(evt.checked);
  };

  public onCollapseChange = async (evt: MatSlideToggleChange): Promise<void> => {
    await this.wowupService.setCollapseToTray(evt.checked);
    this.collapseToTray$.next(evt.checked);
  };

  public onStartWithSystemChange = async (evt: MatSlideToggleChange): Promise<void> => {
    await this.wowupService.setStartWithSystem(evt.checked);
    this.startWithSystem$.next(evt.checked);
  };

  public onStartMinimizedChange = async (evt: MatSlideToggleChange): Promise<void> => {
    await this.wowupService.setStartMinimized(evt.checked);
    this.startMinimized$.next(evt.checked);
  };

  public onKeepAddonDetailTabChange = async (evt: MatSlideToggleChange): Promise<void> => {
    await this.wowupService.setKeepLastAddonDetailTab(evt.checked);
    this.keepAddonDetailTab$.next(evt.checked);
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
    const title: string = this._translateService.instant(
      "PAGES.OPTIONS.APPLICATION.USE_CURSE_PROTOCOL_CONFIRMATION_LABEL"
    );
    const message: string = this._translateService.instant(
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
    const title: string = this._translateService.instant(
      "PAGES.OPTIONS.APPLICATION.USE_HARDWARE_ACCELERATION_CONFIRMATION_LABEL"
    );
    const message: string = this._translateService.instant(
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

          return from(this.wowupService.setUseHardwareAcceleration(evt.checked)).pipe(
            switchMap(() => from(this.electronService.restartApplication()))
          );
        }),
        catchError((error) => {
          console.error(error);
          return of(undefined);
        })
      )
      .subscribe();
  };

  public onSymlinkModeChange = async (evt: MatSlideToggleChange): Promise<void> => {
    if (evt.checked === false) {
      await this.wowupService.setUseSymlinkMode(false);
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
        switchMap((result) => {
          if (!result) {
            evt.source.checked = !evt.source.checked;
            return of(undefined);
          }

          return from(this.wowupService.setUseSymlinkMode(evt.checked)).pipe(
            map(() => this.useSymlinkMode$.next(evt.checked))
          );
        }),
        catchError((error) => {
          console.error(error);
          return of(undefined);
        })
      )
      .subscribe();
  };

  public async onReleaseChannelChange(evt: MatSelectChange): Promise<void> {
    console.debug(evt);
    // this._electronService.invoke("set-release-channel", channel);

    const descriptionKey =
      evt.source.value === WowUpReleaseChannelType.Beta
        ? "PAGES.OPTIONS.APPLICATION.APP_RELEASE_CHANNEL_CONFIRMATION_DESCRIPTION_BETA"
        : "PAGES.OPTIONS.APPLICATION.APP_RELEASE_CHANNEL_CONFIRMATION_DESCRIPTION_STABLE";

    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant("PAGES.OPTIONS.APPLICATION.APP_RELEASE_CHANNEL_CONFIRMATION_LABEL"),
        message: this._translateService.instant(descriptionKey),
        positiveKey: "PAGES.OPTIONS.APPLICATION.APP_RELEASE_CHANNEL_CONFIRMATION_POSITIVE_BUTTON",
      },
    });

    try {
      const result = await firstValueFrom(dialogRef.afterClosed());

      if (!result) {
        evt.source.value = await this.wowupService.getWowUpReleaseChannel();
      } else {
        await this.wowupService.setWowUpReleaseChannel(evt.source.value as WowUpReleaseChannelType);
      }

      this.currentReleaseChannel$.next(evt.source.value as WowUpReleaseChannelType);
    } catch (e) {
      console.error(e);
    }
  }

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
            evt.source.value = this.currentLanguage$.value;
            return of(undefined);
          }

          return from(this.wowupService.setCurrentLanguage(evt.value as string)).pipe(map(() => evt.value as string));
        }),
        switchMap((result) => {
          this.currentLanguage$.next(result);
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
    const newScale = evt.value as number;
    await this._zoomService.setZoomFactor(newScale);
    this.currentScale = newScale;
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
