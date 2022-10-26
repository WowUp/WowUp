import * as _ from "lodash";
import { BehaviorSubject, from, of } from "rxjs";
import { catchError, delay, filter, first, map, switchMap } from "rxjs/operators";

import { OverlayContainer } from "@angular/cdk/overlay";
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
} from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";

import {
  ADDON_PROVIDER_CURSEFORGE,
  ADDON_PROVIDER_CURSEFORGEV2,
  ALLIANCE_LIGHT_THEME,
  ALLIANCE_THEME,
  CURRENT_THEME_KEY,
  DEFAULT_LIGHT_THEME,
  DEFAULT_THEME,
  HORDE_LIGHT_THEME,
  HORDE_THEME,
  IPC_CREATE_APP_MENU_CHANNEL,
  IPC_CREATE_TRAY_MENU_CHANNEL,
  IPC_MENU_ZOOM_IN_CHANNEL,
  IPC_MENU_ZOOM_OUT_CHANNEL,
  IPC_MENU_ZOOM_RESET_CHANNEL,
  IPC_POWER_MONITOR_RESUME,
  IPC_POWER_MONITOR_UNLOCK,
  IPC_REQUEST_INSTALL_FROM_URL,
  WOWUP_LOGO_FILENAME,
  ZOOM_FACTOR_KEY,
} from "../common/constants";
import { Addon } from "../common/entities/addon";
import { AppUpdateState, MenuConfig, SystemTrayConfig } from "../common/wowup/models";
import { AppConfig } from "../environments/environment";
import { InstallFromUrlDialogComponent } from "./components/addons/install-from-url-dialog/install-from-url-dialog.component";
import { AlertDialogComponent } from "./components/common/alert-dialog/alert-dialog.component";
import { AddonSyncError, GitHubFetchReleasesError, GitHubFetchRepositoryError, GitHubLimitError } from "./errors";
import { AddonInstallState } from "./models/wowup/addon-install-state";
import { ElectronService } from "./services";
import { AddonService } from "./services/addons/addon.service";
import { AnalyticsService } from "./services/analytics/analytics.service";
import { FileService } from "./services/files/file.service";
import { SessionService } from "./services/session/session.service";
import { SnackbarService } from "./services/snackbar/snackbar.service";
import { PreferenceStorageService } from "./services/storage/preference-storage.service";
import { WarcraftInstallationService } from "./services/warcraft/warcraft-installation.service";
import { WowUpAddonService } from "./services/wowup/wowup-addon.service";
import { WowUpService } from "./services/wowup/wowup.service";
import { ZoomService } from "./services/zoom/zoom.service";
import { ZoomDirection } from "./utils/zoom.utils";
import { AddonProviderFactory } from "./services/addons/addon.provider.factory";
import {
  ConsentDialogComponent,
  ConsentDialogResult,
} from "./components/common/consent-dialog/consent-dialog.component";
import { WowUpProtocolService } from "./services/wowup/wowup-protocol.service";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
  private _autoUpdateInterval?: number;

  @HostListener("mousewheel", ["$event"])
  public async handleMouseWheelEvent(event: WheelEvent): Promise<void> {
    if (!event.ctrlKey) {
      return;
    }

    try {
      if ((event as any).wheelDelta > 0) {
        await this._zoomService.applyZoom(ZoomDirection.ZoomIn);
      } else {
        await this._zoomService.applyZoom(ZoomDirection.ZoomOut);
      }
    } catch (e) {
      console.error(e);
    }
  }

  public quitEnabled?: boolean;
  public showPreLoad$ = new BehaviorSubject<boolean>(true);

  public constructor(
    private _addonService: AddonService,
    private _addonProviderService: AddonProviderFactory,
    private _analyticsService: AnalyticsService,
    private _cdRef: ChangeDetectorRef,
    private _dialog: MatDialog,
    private _fileService: FileService,
    private _preferenceStore: PreferenceStorageService,
    private _snackbarService: SnackbarService,
    private _translateService: TranslateService,
    private _warcraftInstallationService: WarcraftInstallationService,
    private _wowupAddonService: WowUpAddonService,
    private _zoomService: ZoomService,
    private _wowUpProtocolService: WowUpProtocolService,
    public electronService: ElectronService,
    public overlayContainer: OverlayContainer,
    public sessionService: SessionService,
    public wowUpService: WowUpService
  ) {
    this._warcraftInstallationService.wowInstallations$
      .pipe(
        first((installations) => installations.length > 0),
        switchMap(() => from(this.initializeAutoUpdate()))
      )
      .subscribe();

    this.electronService.appUpdate$.subscribe((evt) => {
      if (evt.state === AppUpdateState.Error) {
        if (evt.error.indexOf("dev-app-update.yml") === -1) {
          this._snackbarService.showErrorSnackbar("APP.WOWUP_UPDATE.UPDATE_ERROR");
        }
      } else if (evt.state === AppUpdateState.Downloaded) {
        // Force the user to update when one is ready
        const dialogRef = this._dialog.open(AlertDialogComponent, {
          minWidth: 250,
          disableClose: true,
          data: {
            title: this._translateService.instant("APP.WOWUP_UPDATE.INSTALL_TITLE"),
            message: this._translateService.instant("APP.WOWUP_UPDATE.SNACKBAR_TEXT"),
            positiveButton: "APP.WOWUP_UPDATE.DOWNLOADED_TOOLTIP",
            positiveButtonColor: "primary",
            positiveButtonStyle: "raised",
          },
        });

        dialogRef
          .afterClosed()
          .pipe(first())
          .subscribe(() => {
            this.wowUpService.installUpdate();
          });
      }
    });

    this._wowUpProtocolService.initialize();
  }

  public ngOnInit(): void {
    this.loadZoom().catch(console.error);

    this.wowUpService
      .getCurrentTheme()
      .then((theme) => {
        this.overlayContainer.getContainerElement().classList.add(theme);
      })
      .catch(console.error);

    this.overlayContainer.getContainerElement().classList.add(this.electronService.platform);

    this.wowUpService.preferenceChange$.pipe(filter((pref) => pref.key === CURRENT_THEME_KEY)).subscribe((pref) => {
      this.overlayContainer
        .getContainerElement()
        .classList.remove(
          HORDE_THEME,
          HORDE_LIGHT_THEME,
          ALLIANCE_THEME,
          ALLIANCE_LIGHT_THEME,
          DEFAULT_THEME,
          DEFAULT_LIGHT_THEME
        );
      this.overlayContainer.getContainerElement().classList.add(pref.value);
    });

    this._addonService.syncError$.subscribe(this.onAddonSyncError);

    this._addonService.addonAction$
      .pipe(
        filter((action) => action.type === "sync" || action.type === "scan"),
        switchMap(() => from(this.updateBadgeCount()))
      )
      .subscribe();

    //If the window is restored update the badge number
    this.electronService.windowResumed$
      .pipe(
        delay(1000), // If you dont delay this on Mac, it will sometimes not show up
        switchMap(() => from(this.updateBadgeCount()))
      )
      .subscribe();

    // If an addon is installed/updated check the badge number
    this._addonService.addonInstalled$
      .pipe(
        filter((evt) => evt.installState === AddonInstallState.Complete),
        switchMap(() => from(this.updateBadgeCount()))
      )
      .subscribe();

    // If user removes an addon, update the badge count
    this._addonService.addonRemoved$.pipe(switchMap(() => from(this.updateBadgeCount()))).subscribe();

    this.electronService.on(IPC_MENU_ZOOM_IN_CHANNEL, this.onMenuZoomIn);
    this.electronService.on(IPC_MENU_ZOOM_OUT_CHANNEL, this.onMenuZoomOut);
    this.electronService.on(IPC_MENU_ZOOM_RESET_CHANNEL, this.onMenuZoomReset);
    this.electronService.on(IPC_REQUEST_INSTALL_FROM_URL, this.onRequestInstallFromUrl);

    from(this.electronService.getAppOptions())
      .pipe(
        first(),
        map((appOptions) => {
          this.quitEnabled = appOptions.quit;
          this._cdRef.detectChanges();
        }),
        switchMap(() => from(this.electronService.processPendingOpenUrls())),
        catchError((err) => {
          console.error(err);
          return of(undefined);
        })
      )
      .subscribe();

    this.electronService.powerMonitor$.pipe(filter((evt) => !!evt)).subscribe((evt) => {
      console.log("Stopping auto update...");
      window.clearInterval(this._autoUpdateInterval);
      this._autoUpdateInterval = undefined;

      if (evt === IPC_POWER_MONITOR_RESUME || evt === IPC_POWER_MONITOR_UNLOCK) {
        this.initializeAutoUpdate().catch((e) => console.error(e));
      }
    });
  }

  private async loadZoom() {
    const zoomPref = await this._preferenceStore.getAsync(ZOOM_FACTOR_KEY);
    const zoomFactor = parseFloat(zoomPref);
    if (!isNaN(zoomFactor) && isFinite(zoomFactor)) {
      this._zoomService.setZoomFactor(zoomFactor).catch((e) => console.error(e));
    }
  }

  public ngAfterViewInit(): void {
    this.onNgAfterViewInit().catch((e) => console.error(e));
  }

  private async onNgAfterViewInit(): Promise<void> {
    await this.createAppMenu();
    await this.createSystemTray();
    await this._analyticsService.trackStartup();
    await this.showRequiredDialogs();
  }

  private async showRequiredDialogs(): Promise<void> {
    try {
      const shouldShowConsent = await this.shouldShowConsentDialog();
      if (shouldShowConsent) {
        this.openConsentDialog();
        return;
      }

      this.showPreLoad$.next(false);
    } catch (e) {
      console.error(e);
    }
  }

  private async shouldShowConsentDialog(): Promise<boolean> {
    const shouldPromptTelemetry = await this._analyticsService.shouldPromptTelemetry();
    const shouldShowConsentDialog = await this._addonProviderService.shouldShowConsentDialog();
    return shouldPromptTelemetry || shouldShowConsentDialog;
  }

  public ngOnDestroy(): void {
    this.electronService.off(IPC_MENU_ZOOM_IN_CHANNEL, this.onMenuZoomIn);
    this.electronService.off(IPC_MENU_ZOOM_OUT_CHANNEL, this.onMenuZoomOut);
    this.electronService.off(IPC_MENU_ZOOM_RESET_CHANNEL, this.onMenuZoomReset);
  }

  public onMenuZoomIn = (): void => {
    this._zoomService.applyZoom(ZoomDirection.ZoomIn).catch((e) => console.error(e));
  };

  public onMenuZoomOut = (): void => {
    this._zoomService.applyZoom(ZoomDirection.ZoomOut).catch((e) => console.error(e));
  };

  public onMenuZoomReset = (): void => {
    this._zoomService.applyZoom(ZoomDirection.ZoomReset).catch((e) => console.error(e));
  };

  public onRequestInstallFromUrl = (evt: unknown, path?: string): void => {
    this.openInstallFromUrlDialog(path);
  };

  public openConsentDialog(): void {
    const dialogRef = this._dialog.open(ConsentDialogComponent, {
      disableClose: true,
    });

    dialogRef
      .afterClosed()
      .pipe(
        switchMap((result: ConsentDialogResult) =>
          from(this._addonProviderService.setProviderEnabled("Wago", result.wagoProvider)).pipe(map(() => result))
        ),
        switchMap((result) => from(this._addonProviderService.updateWagoConsent()).pipe(map(() => result))),
        switchMap((result: ConsentDialogResult) => {
          this._analyticsService.setTelemetryEnabled(result.telemetry).catch(console.error);
          if (result.telemetry) {
            return from(this._analyticsService.trackStartup());
          }

          return of(undefined);
        })
      )
      .subscribe(() => {
        this.showRequiredDialogs().catch((e) => console.error(e));
      });
  }

  private openInstallFromUrlDialog(path?: string) {
    if (!path) {
      return;
    }

    const dialogRef = this._dialog.open(InstallFromUrlDialogComponent);
    dialogRef.componentInstance.query = path;
  }

  private async initializeAutoUpdate() {
    if (this._autoUpdateInterval !== undefined) {
      console.warn(`Auto addon update interval already exists`);
      return;
    }

    this._autoUpdateInterval = window.setInterval(() => {
      this.onAutoUpdateInterval().catch((e) => console.error(e));
    }, AppConfig.autoUpdateIntervalMs);

    await this.onAutoUpdateInterval();
  }

  private onAutoUpdateInterval = async () => {
    try {
      console.log("onAutoUpdateInterval");
      await this._addonService.syncAllClients();
      const updatedAddons = await this._addonService.processAutoUpdates();

      await this._wowupAddonService.updateForAllClientTypes();

      await this.updateBadgeCount();

      if (!updatedAddons || updatedAddons.length === 0) {
        await this.checkQuitEnabled();
        return;
      }

      const enableSystemNotifications = await this.wowUpService.getEnableSystemNotifications();
      if (enableSystemNotifications) {
        const addonsWithNotificationsEnabled = updatedAddons.filter(
          (addon) => addon.autoUpdateNotificationsEnabled === true
        );

        // Windows notification only shows so many chars
        if (this.getAddonNamesLength(addonsWithNotificationsEnabled) > 60) {
          await this.showManyAddonsAutoUpdated(addonsWithNotificationsEnabled);
        } else {
          await this.showFewAddonsAutoUpdated(addonsWithNotificationsEnabled);
        }
      } else {
        await this.checkQuitEnabled();
      }
    } catch (e) {
      console.error("Error during auto update", e);
    } finally {
      this.sessionService.autoUpdateComplete();
    }
  };

  private async showManyAddonsAutoUpdated(updatedAddons: Addon[]) {
    const iconPath = await this._fileService.getAssetFilePath(WOWUP_LOGO_FILENAME);
    const translated: { [key: string]: string } = await this._translateService
      .get(["APP.AUTO_UPDATE_NOTIFICATION_TITLE", "APP.AUTO_UPDATE_NOTIFICATION_BODY"], {
        count: updatedAddons.length,
      })
      .toPromise();

    const notification = this.electronService.showNotification(translated["APP.AUTO_UPDATE_NOTIFICATION_TITLE"], {
      body: translated["APP.AUTO_UPDATE_NOTIFICATION_BODY"],
      icon: iconPath,
    });

    notification.addEventListener("click", this.onClickNotification, { once: true });
    notification.addEventListener("close", this.onAutoUpdateNotificationClosed, { once: true });
  }

  private async showFewAddonsAutoUpdated(updatedAddons: Addon[]) {
    const addonNames = _.map(updatedAddons, (addon) => addon.name);
    const addonText = _.join(addonNames, "\r\n");
    const iconPath = await this._fileService.getAssetFilePath(WOWUP_LOGO_FILENAME);
    const translated: { [key: string]: string } = await this._translateService
      .get(["APP.AUTO_UPDATE_NOTIFICATION_TITLE", "APP.AUTO_UPDATE_FEW_NOTIFICATION_BODY"], {
        addonNames: addonText,
      })
      .toPromise();

    const notification = this.electronService.showNotification(translated["APP.AUTO_UPDATE_NOTIFICATION_TITLE"], {
      body: translated["APP.AUTO_UPDATE_FEW_NOTIFICATION_BODY"],
      icon: iconPath,
    });

    notification.addEventListener("click", this.onClickNotification, { once: true });
    notification.addEventListener("close", this.onAutoUpdateNotificationClosed, { once: true });
  }

  private onClickNotification = () => {
    this.electronService.focusWindow().catch((e) => console.error(`Failed to focus window on notification click`, e));
  };

  private getAddonNames(addons: Addon[]) {
    return _.map(addons, (addon) => addon.name);
  }

  private getAddonNamesLength(addons: Addon[]) {
    return _.join(this.getAddonNames(addons), " ").length;
  }

  private onAutoUpdateNotificationClosed = () => {
    this.checkQuitEnabled().catch((e) => console.error(e));
  };

  private async checkQuitEnabled() {
    const appOptions = await this.electronService.getAppOptions();
    if (!appOptions.quit) {
      return;
    }

    console.debug("checkQuitEnabled");
    this.electronService.quitApplication().catch((e) => console.error(e));
  }

  private onAddonSyncError = (error: AddonSyncError) => {
    let errorMessage: string = this._translateService.instant("COMMON.ERRORS.ADDON_SYNC_ERROR", {
      providerName: error.providerName,
    });

    if (error.addonName) {
      errorMessage = this._translateService.instant("COMMON.ERRORS.ADDON_SYNC_FULL_ERROR", {
        installationName: error.installationName,
        providerName: error.providerName,
        addonName: error.addonName,
      });
    }

    if (error.innerError instanceof GitHubLimitError) {
      const err = error.innerError;
      const max = err.rateLimitMax;
      const reset = new Date(err.rateLimitReset * 1000).toLocaleString();
      errorMessage = this._translateService.instant("COMMON.ERRORS.GITHUB_LIMIT_ERROR", {
        max,
        reset,
      });
    } else if (
      error.innerError instanceof GitHubFetchReleasesError ||
      error.innerError instanceof GitHubFetchRepositoryError
    ) {
      errorMessage = this._translateService.instant("COMMON.ERRORS.GITHUB_REPOSITORY_FETCH_ERROR", {
        addonName: error.addonName,
      });
    } else if (error instanceof AddonSyncError) {
      return;
    }

    this._snackbarService.showErrorSnackbar(errorMessage);
  };

  private async createAppMenu() {
    console.log("Creating app menu");

    // APP MENU
    const quitKey = "APP.APP_MENU.QUIT";

    // EDIT MENU
    const editKey = "APP.APP_MENU.EDIT.LABEL";
    const copyKey = "APP.APP_MENU.EDIT.COPY";
    const cutKey = "APP.APP_MENU.EDIT.CUT";
    const pasteKey = "APP.APP_MENU.EDIT.PASTE";
    const redoKey = "APP.APP_MENU.EDIT.REDO";
    const selectAllKey = "APP.APP_MENU.EDIT.SELECT_ALL";
    const undoKey = "APP.APP_MENU.EDIT.UNDO";

    // VIEW MENU
    const viewKey = "APP.APP_MENU.VIEW.LABEL";
    const forceReloadKey = "APP.APP_MENU.VIEW.FORCE_RELOAD";
    const reloadKey = "APP.APP_MENU.VIEW.RELOAD";
    const toggleDevToolsKey = "APP.APP_MENU.VIEW.TOGGLE_DEV_TOOLS";
    const toggleFullScreenKey = "APP.APP_MENU.VIEW.TOGGLE_FULL_SCREEN";
    const zoomInKey = "APP.APP_MENU.VIEW.ZOOM_IN";
    const zoomOutKey = "APP.APP_MENU.VIEW.ZOOM_OUT";
    const zoomResetKey = "APP.APP_MENU.VIEW.ZOOM_RESET";

    // WINDOW MENU
    const windowKey = "APP.APP_MENU.WINDOW.LABEL";
    const windowCloseKey = "APP.APP_MENU.WINDOW.CLOSE";

    const result = await this._translateService
      .get([
        editKey,
        viewKey,
        zoomInKey,
        zoomOutKey,
        zoomResetKey,
        copyKey,
        cutKey,
        forceReloadKey,
        quitKey,
        redoKey,
        reloadKey,
        selectAllKey,
        toggleDevToolsKey,
        toggleFullScreenKey,
        undoKey,
        pasteKey,
        windowKey,
        windowCloseKey,
      ])
      .toPromise();

    const config: MenuConfig = {
      editLabel: result[editKey],
      viewLabel: result[viewKey],
      zoomInLabel: result[zoomInKey],
      zoomOutLabel: result[zoomOutKey],
      zoomResetLabel: result[zoomResetKey],
      copyLabel: result[copyKey],
      cutLabel: result[cutKey],
      forceReloadLabel: result[forceReloadKey],
      pasteLabel: result[pasteKey],
      quitLabel: result[quitKey],
      redoLabel: result[redoKey],
      reloadLabel: result[reloadKey],
      selectAllLabel: result[selectAllKey],
      toggleDevToolsLabel: result[toggleDevToolsKey],
      toggleFullScreenLabel: result[toggleFullScreenKey],
      undoLabel: result[undoKey],
      windowLabel: result[windowKey],
      windowCloseLabel: result[windowCloseKey],
    };

    try {
      const trayCreated = await this.electronService.invoke(IPC_CREATE_APP_MENU_CHANNEL, config);
      console.log("App menu created", trayCreated);
    } catch (e) {
      console.error("Failed to create tray", e);
    }
  }

  private async createSystemTray() {
    console.log("Creating tray");
    const result = await this._translateService
      .get(["APP.SYSTEM_TRAY.QUIT_ACTION", "APP.SYSTEM_TRAY.SHOW_ACTION"])
      .toPromise();

    const config: SystemTrayConfig = {
      quitLabel: result["APP.SYSTEM_TRAY.QUIT_ACTION"],
      checkUpdateLabel: result["APP.SYSTEM_TRAY.CHECK_UPDATE"],
      showLabel: result["APP.SYSTEM_TRAY.SHOW_ACTION"],
    };

    try {
      const trayCreated = await this.electronService.invoke(IPC_CREATE_TRAY_MENU_CHANNEL, config);
      console.log("Tray created", trayCreated);
    } catch (e) {
      console.error("Failed to create tray", e);
    }
  }

  private async updateBadgeCount(): Promise<void> {
    const addons = await this._addonService.getAllAddonsAvailableForUpdate();
    const ct = addons.length;
    try {
      await this.wowUpService.updateAppBadgeCount(ct);
    } catch (e) {
      console.error("Failed to update badge count", e);
    }
  }
}
