import { AfterViewInit, ChangeDetectionStrategy, Component } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";
import { CREATE_TRAY_MENU_CHANNEL } from "../common/constants";
import { SystemTrayConfig } from "../common/wowup/system-tray-config";
import { TelemetryDialogComponent } from "./components/telemetry-dialog/telemetry-dialog.component";
import { ElectronService } from "./services";
import { AddonService } from "./services/addons/addon.service";
import { AnalyticsService } from "./services/analytics/analytics.service";
import { FileService } from "./services/files/file.service";
import { WowUpService } from "./services/wowup/wowup.service";
import { IconService } from "./services/icons/icon.service";

const AUTO_UPDATE_PERIOD_MS = 60 * 60 * 1000; // 1 hour

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements AfterViewInit {
  private _autoUpdateInterval?: number;

  public get quitEnabled() {
    return this._electronService.appOptions.quit;
  }

  constructor(
    private _analyticsService: AnalyticsService,
    private _electronService: ElectronService,
    private _fileService: FileService,
    private translate: TranslateService,
    private _wowUpService: WowUpService,
    private _dialog: MatDialog,
    private _addonService: AddonService,
    private _iconService: IconService
  ) {
    this.translate.setDefaultLang("en");
    this.translate.use(this._wowUpService.currentLanguage);
  }

  ngAfterViewInit(): void {
    this.createSystemTray();

    if (this._analyticsService.shouldPromptTelemetry) {
      this.openDialog();
    } else {
      this._analyticsService.trackStartup();
    }

    this.onAutoUpdateInterval();
    this._autoUpdateInterval = window.setInterval(this.onAutoUpdateInterval, AUTO_UPDATE_PERIOD_MS);
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

  private onAutoUpdateInterval = async () => {
    console.debug("Auto update");
    const updateCount = await this._addonService.processAutoUpdates();

    if (updateCount === 0) {
      this.checkQuitEnabled();
      return;
    }

    if (this._wowUpService.enableSystemNotifications) {
      const iconPath = await this._fileService.getAssetFilePath("wowup_logo_512np.png");
      const translated = await this.translate
        .get(["APP.AUTO_UPDATE_NOTIFICATION_TITLE", "APP.AUTO_UPDATE_NOTIFICATION_BODY"], {
          count: updateCount,
        })
        .toPromise();

      const notification = this._electronService.showNotification(translated["APP.AUTO_UPDATE_NOTIFICATION_TITLE"], {
        body: translated["APP.AUTO_UPDATE_NOTIFICATION_BODY"],
        icon: iconPath,
      });

      notification.addEventListener("close", () => {
        this.checkQuitEnabled();
      });
    } else {
      this.checkQuitEnabled();
    }
  };

  private checkQuitEnabled() {
    if (!this._electronService.appOptions.quit) {
      return;
    }

    console.debug("checkQuitEnabled");
    this._electronService.quitApplication();
  }

  private async createSystemTray() {
    const result = await this.translate.get(["APP.SYSTEM_TRAY.QUIT_ACTION", "APP.SYSTEM_TRAY.SHOW_ACTION"]).toPromise();

    console.debug("Creating tray", result);
    const config: SystemTrayConfig = {
      quitLabel: result["APP.SYSTEM_TRAY.QUIT_ACTION"],
      checkUpdateLabel: result["APP.SYSTEM_TRAY.CHECK_UPDATE"],
      showLabel: result["APP.SYSTEM_TRAY.SHOW_ACTION"],
    };

    try {
      const trayCreated = await this._electronService.invoke(CREATE_TRAY_MENU_CHANNEL, config);
      console.log("Tray created", trayCreated);
    } catch (e) {
      console.error("Failed to create tray", e);
    }
  }
}
