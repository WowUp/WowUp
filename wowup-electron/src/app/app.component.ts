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
import { interval, Subscription } from "rxjs";
import { filter, tap } from "rxjs/operators";
import { map, join } from "lodash";
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
  IPC_REQUEST_INSTALL_FROM_URL
} from "../common/constants";
import { SystemTrayConfig } from "../common/wowup/system-tray-config";
import { MenuConfig } from "../common/wowup/menu-config";
import { TelemetryDialogComponent } from "./components/telemetry-dialog/telemetry-dialog.component";
import { ElectronService } from "./services";
import { AddonService } from "./services/addons/addon.service";
import { AnalyticsService } from "./services/analytics/analytics.service";
import { FileService } from "./services/files/file.service";
import { WowUpService } from "./services/wowup/wowup.service";
import { IconService } from "./services/icons/icon.service";
import { SessionService } from "./services/session/session.service";
import { ZoomDirection } from "./utils/zoom.utils";
import { Addon } from "./entities/addon";
import { AppConfig } from "../environments/environment";
import { PreferenceStorageService } from "./services/storage/preference-storage.service";
import { InstallFromUrlDialogComponent } from "./components/install-from-url-dialog/install-from-url-dialog.component";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
  private _autoUpdateInterval?: Subscription;

  // @HostListener("document:fullscreenchange", ["$event"])
  // handleKeyboardEvent(event: Event) {
  //   console.debug("fullscreenchange", event);
  // }

  public quitEnabled?: boolean;

  constructor(
    private _analyticsService: AnalyticsService,
    private _electronService: ElectronService,
    private _fileService: FileService,
    private translate: TranslateService,
    private _dialog: MatDialog,
    private _addonService: AddonService,
    private _iconService: IconService,
    private _sessionService: SessionService,
    private _preferenceStore: PreferenceStorageService,
    private _cdRef: ChangeDetectorRef,
    public overlayContainer: OverlayContainer,
    public wowUpService: WowUpService
  ) {}

  ngOnInit(): void {
    const zoomFactor = parseFloat(this._preferenceStore.get(ZOOM_FACTOR_KEY) as string);
    if (!isNaN(zoomFactor) && isFinite(zoomFactor)) {
      this._electronService.setZoomFactor(zoomFactor);
    }

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

    this._electronService.on(IPC_MENU_ZOOM_IN_CHANNEL, this.onMenuZoomIn);
    this._electronService.on(IPC_MENU_ZOOM_OUT_CHANNEL, this.onMenuZoomOut);
    this._electronService.on(IPC_MENU_ZOOM_RESET_CHANNEL, this.onMenuZoomReset);
	  this._electronService.on(IPC_REQUEST_INSTALL_FROM_URL, this.onRequestInstallFromUrl);

    this._electronService.getAppOptions().then((appOptions) => {
      this.openInstallFromUrlDialog(appOptions.install);
      this.quitEnabled = appOptions.quit;
      this._cdRef.detectChanges();
    });

    this._electronService.powerMonitor$.pipe(filter((evt) => !!evt)).subscribe((evt) => {
      console.log("Stopping auto update...");
      this._autoUpdateInterval?.unsubscribe();
      this._autoUpdateInterval = undefined;

      if (evt === IPC_POWER_MONITOR_RESUME || evt === IPC_POWER_MONITOR_UNLOCK) {
        this.initializeAutoUpdate();
      }
    });
  }

  ngAfterViewInit(): void {
    this.createAppMenu();
    this.createSystemTray();

    if (this._analyticsService.shouldPromptTelemetry) {
      this.openDialog();
    } else {
      this._analyticsService.trackStartup();
    }

    this.initializeAutoUpdate();
  }

  ngOnDestroy(): void {
    this._electronService.off(IPC_MENU_ZOOM_IN_CHANNEL, this.onMenuZoomIn);
    this._electronService.off(IPC_MENU_ZOOM_OUT_CHANNEL, this.onMenuZoomOut);
    this._electronService.off(IPC_MENU_ZOOM_RESET_CHANNEL, this.onMenuZoomReset);
  }

  onMenuZoomIn = () => {
    this._electronService.applyZoom(ZoomDirection.ZoomIn);
  };

  onMenuZoomOut = () => {
    this._electronService.applyZoom(ZoomDirection.ZoomOut);
  };

  onMenuZoomReset = () => {
    this._electronService.applyZoom(ZoomDirection.ZoomReset);
  };

  onRequestInstallFromUrl = async (evt, path?: string) => {
    await this.openInstallFromUrlDialog(path);
  }

  openDialog(): void {
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

  private async openInstallFromUrlDialog(path?: string) {
    if (!path)
      return;
    var dialogRef = await this._dialog.open(InstallFromUrlDialogComponent);
    dialogRef.componentInstance.query = path;
  }

  private async initializeAutoUpdate() {
    if (this._autoUpdateInterval) {
      return;
    }

    await this.onAutoUpdateInterval();
    this._autoUpdateInterval = interval(AppConfig.autoUpdateIntervalMs)
      .pipe(tap(async () => await this.onAutoUpdateInterval()))
      .subscribe();
  }

  private onAutoUpdateInterval = async () => {
    try {
      console.log("onAutoUpdateInterval");
      const updatedAddons = await this._addonService.processAutoUpdates();

      if (!updatedAddons || updatedAddons.length === 0) {
        this.checkQuitEnabled();
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
        this.checkQuitEnabled();
      }
    } catch (e) {
      console.error("Error during auto update", e);
    } finally {
      this._sessionService.autoUpdateComplete();
    }
  };

  private async showManyAddonsAutoUpdated(updatedAddons: Addon[]) {
    const iconPath = await this._fileService.getAssetFilePath("wowup_logo_512np.png");
    const translated = await this.translate
      .get(["APP.AUTO_UPDATE_NOTIFICATION_TITLE", "APP.AUTO_UPDATE_NOTIFICATION_BODY"], {
        count: updatedAddons.length,
      })
      .toPromise();

    const notification = this._electronService.showNotification(translated["APP.AUTO_UPDATE_NOTIFICATION_TITLE"], {
      body: translated["APP.AUTO_UPDATE_NOTIFICATION_BODY"],
      icon: iconPath,
    });

    notification.addEventListener("close", this.onAutoUpdateNotificationClosed, { once: true });
  }

  private async showFewAddonsAutoUpdated(updatedAddons: Addon[]) {
    const addonNames = map(updatedAddons, (addon) => addon.name);
    const addonText = join(addonNames, "\r\n");
    const iconPath = await this._fileService.getAssetFilePath("wowup_logo_512np.png");
    const translated = await this.translate
      .get(["APP.AUTO_UPDATE_NOTIFICATION_TITLE", "APP.AUTO_UPDATE_FEW_NOTIFICATION_BODY"], {
        addonNames: addonText,
      })
      .toPromise();

    const notification = this._electronService.showNotification(translated["APP.AUTO_UPDATE_NOTIFICATION_TITLE"], {
      body: translated["APP.AUTO_UPDATE_FEW_NOTIFICATION_BODY"],
      icon: iconPath,
    });

    notification.addEventListener("close", this.onAutoUpdateNotificationClosed, { once: true });
  }

  private getAddonNames(addons: Addon[]) {
    return map(addons, (addon) => addon.name);
  }

  private getAddonNamesLength(addons: Addon[]) {
    return join(this.getAddonNames(addons), " ").length;
  }

  private onAutoUpdateNotificationClosed = () => {
    this.checkQuitEnabled();
  };

  private async checkQuitEnabled() {
    const appOptions = await this._electronService.getAppOptions();
    if (!appOptions.quit) {
      return;
    }

    console.debug("checkQuitEnabled");
    this._electronService.quitApplication();
  }

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
      const trayCreated = await this._electronService.invoke(IPC_CREATE_APP_MENU_CHANNEL, config);
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
      const trayCreated = await this._electronService.invoke(IPC_CREATE_TRAY_MENU_CHANNEL, config);
      console.log("Tray created", trayCreated);
    } catch (e) {
      console.error("Failed to create tray", e);
    }
  }
}
