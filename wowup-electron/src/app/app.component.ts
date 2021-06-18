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
import { OverlayContainer } from "@angular/cdk/overlay";
import { combineLatest, from, of } from "rxjs";
import { catchError, delay, filter, first, map, switchMap } from "rxjs/operators";
import * as _ from "lodash";
import {
  ALLIANCE_LIGHT_THEME,
  ALLIANCE_THEME,
  IPC_CREATE_APP_MENU_CHANNEL,
  IPC_CREATE_TRAY_MENU_CHANNEL,
  CURRENT_THEME_KEY,
  DEFAULT_LIGHT_THEME,
  DEFAULT_THEME,
  HORDE_LIGHT_THEME,
  HORDE_THEME,
  IPC_MENU_ZOOM_IN_CHANNEL,
  IPC_MENU_ZOOM_OUT_CHANNEL,
  IPC_MENU_ZOOM_RESET_CHANNEL,
  IPC_POWER_MONITOR_RESUME,
  IPC_POWER_MONITOR_UNLOCK,
  ZOOM_FACTOR_KEY,
  IPC_REQUEST_INSTALL_FROM_URL,
  WOWUP_LOGO_FILENAME,
} from "../common/constants";
import { AppUpdateState, MenuConfig, SystemTrayConfig } from "../common/wowup/models";
import { TelemetryDialogComponent } from "./components/telemetry-dialog/telemetry-dialog.component";
import { ElectronService } from "./services";
import { AddonService } from "./services/addons/addon.service";
import { AnalyticsService } from "./services/analytics/analytics.service";
import { FileService } from "./services/files/file.service";
import { WowUpService } from "./services/wowup/wowup.service";
import { SessionService } from "./services/session/session.service";
import { ZoomDirection } from "./utils/zoom.utils";
import { Addon } from "../common/entities/addon";
import { AppConfig } from "../environments/environment";
import { PreferenceStorageService } from "./services/storage/preference-storage.service";
import { InstallFromUrlDialogComponent } from "./components/install-from-url-dialog/install-from-url-dialog.component";
import { WowUpAddonService } from "./services/wowup/wowup-addon.service";
import { AddonSyncError, GitHubFetchReleasesError, GitHubFetchRepositoryError, GitHubLimitError } from "./errors";
import { SnackbarService } from "./services/snackbar/snackbar.service";
import { WarcraftInstallationService } from "./services/warcraft/warcraft-installation.service";
import { ZoomService } from "./services/zoom/zoom.service";
import { AlertDialogComponent } from "./components/alert-dialog/alert-dialog.component";

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
  public showPreLoad = true;

  public constructor(
    private _analyticsService: AnalyticsService,
    public electronService: ElectronService,
    private _fileService: FileService,
    private translate: TranslateService,
    private _dialog: MatDialog,
    private _addonService: AddonService,
    private _sessionService: SessionService,
    private _preferenceStore: PreferenceStorageService,
    private _cdRef: ChangeDetectorRef,
    private _wowupAddonService: WowUpAddonService,
    private _snackbarService: SnackbarService,
    private _warcraftInstallationService: WarcraftInstallationService,
    private _zoomService: ZoomService,
    public overlayContainer: OverlayContainer,
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
            title: this.translate.instant("APP.WOWUP_UPDATE.INSTALL_TITLE"),
            message: this.translate.instant("APP.WOWUP_UPDATE.SNACKBAR_TEXT"),
            positiveButton: "APP.WOWUP_UPDATE.DOWNLOADED_TOOLTIP",
            positiveButtonColor: "primary",
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
  }

  public ngOnInit(): void {
    const zoomFactor = parseFloat(this._preferenceStore.get(ZOOM_FACTOR_KEY));
    if (!isNaN(zoomFactor) && isFinite(zoomFactor)) {
      this._zoomService.setZoomFactor(zoomFactor).catch((e) => console.error(e));
    }

    this.overlayContainer.getContainerElement().classList.add(this.electronService.platform);
    this.overlayContainer.getContainerElement().classList.add(this.wowUpService.currentTheme);

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

    // If an addon is installed/updated check the badge number
    combineLatest([this._addonService.addonInstalled$, this._addonService.addonRemoved$]).subscribe(() => {
      this.electronService
        .updateAppBadgeCount(this._addonService.getAllAddonsAvailableForUpdate().length)
        .catch((e) => console.error(e));
    });

    this.electronService.on(IPC_MENU_ZOOM_IN_CHANNEL, this.onMenuZoomIn);
    this.electronService.on(IPC_MENU_ZOOM_OUT_CHANNEL, this.onMenuZoomOut);
    this.electronService.on(IPC_MENU_ZOOM_RESET_CHANNEL, this.onMenuZoomReset);
    this.electronService.on(IPC_REQUEST_INSTALL_FROM_URL, this.onRequestInstallFromUrl);

    from(this.electronService.getAppOptions())
      .pipe(
        first(),
        delay(2000),
        map((appOptions) => {
          this.showPreLoad = false;
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

  public ngAfterViewInit(): void {
    from(this.createAppMenu())
      .pipe(
        first(),
        switchMap(() => from(this.createSystemTray())),
        map(() => {
          if (this._analyticsService.shouldPromptTelemetry) {
            this.openDialog();
          } else {
            this._analyticsService.trackStartup();
          }
        }),
        catchError((e) => {
          console.error(e);
          return of(undefined);
        })
      )
      .subscribe();
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

  public openDialog(): void {
    const dialogRef = this._dialog.open(TelemetryDialogComponent, {
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      this._analyticsService.telemetryEnabled = result;
      if (result) {
        this._analyticsService.trackStartup();
      }
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

      await this.electronService.updateAppBadgeCount(this._addonService.getAllAddonsAvailableForUpdate().length);

      if (!updatedAddons || updatedAddons.length === 0) {
        await this.checkQuitEnabled();
        return;
      }

      if (this.wowUpService.enableSystemNotifications) {
        // Windows notification only shows so many chars
        if (this.getAddonNamesLength(updatedAddons) > 60) {
          await this.showManyAddonsAutoUpdated(updatedAddons);
        } else {
          await this.showFewAddonsAutoUpdated(updatedAddons);
        }
      } else {
        await this.checkQuitEnabled();
      }
    } catch (e) {
      console.error("Error during auto update", e);
    } finally {
      this._sessionService.autoUpdateComplete();
    }
  };

  private async showManyAddonsAutoUpdated(updatedAddons: Addon[]) {
    const iconPath = await this._fileService.getAssetFilePath(WOWUP_LOGO_FILENAME);
    const translated = await this.translate
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
    const translated = await this.translate
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
    let errorMessage = this.translate.instant("COMMON.ERRORS.ADDON_SYNC_ERROR", {
      providerName: error.providerName,
    });

    if (error.addonName) {
      errorMessage = this.translate.instant("COMMON.ERRORS.ADDON_SYNC_FULL_ERROR", {
        installationName: error.installationName,
        providerName: error.providerName,
        addonName: error.addonName,
      });
    }

    if (error.innerError instanceof GitHubLimitError) {
      const err = error.innerError;
      const max = err.rateLimitMax;
      const reset = new Date(err.rateLimitReset * 1000).toLocaleString();
      errorMessage = this.translate.instant("COMMON.ERRORS.GITHUB_LIMIT_ERROR", {
        max,
        reset,
      });
    } else if (
      error.innerError instanceof GitHubFetchReleasesError ||
      error.innerError instanceof GitHubFetchRepositoryError
    ) {
      errorMessage = this.translate.instant("COMMON.ERRORS.GITHUB_REPOSITORY_FETCH_ERROR", {
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

    const result = await this.translate
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
    const result = await this.translate.get(["APP.SYSTEM_TRAY.QUIT_ACTION", "APP.SYSTEM_TRAY.SHOW_ACTION"]).toPromise();

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
}
