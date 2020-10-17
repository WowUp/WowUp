import { AfterViewInit, Component } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";
import { AppConfig } from "../environments/environment";
import { TelemetryDialogComponent } from "./components/telemetry-dialog/telemetry-dialog.component";
import { ElectronService } from "./services";
import { AddonService } from "./services/addons/addon.service";
import { AnalyticsService } from "./services/analytics/analytics.service";
import { WarcraftService } from "./services/warcraft/warcraft.service";
import { WowUpService } from "./services/wowup/wowup.service";

const AUTO_UPDATE_PERIOD_MS = 60 * 60 * 1000; // 1 hour

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent implements AfterViewInit {
  private _autoUpdateInterval?: number;

  constructor(
    private _analyticsService: AnalyticsService,
    private electronService: ElectronService,
    private translate: TranslateService,
    private warcraft: WarcraftService,
    private _wowUpService: WowUpService,
    private _dialog: MatDialog,
    private _addonService: AddonService
  ) {
    this.translate.setDefaultLang("en");

    this.translate.use(this.electronService.locale);
  }

  ngAfterViewInit(): void {
    if (this._analyticsService.shouldPromptTelemetry) {
      this.openDialog();
    } else {
      this._analyticsService.trackStartup();
    }

    this.onAutoUpdateInterval();
    this._autoUpdateInterval = window.setInterval(
      this.onAutoUpdateInterval,
      AUTO_UPDATE_PERIOD_MS
    );
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
    console.log("Auto update");
    const updateCount = await this._addonService.processAutoUpdates();
  };
}
