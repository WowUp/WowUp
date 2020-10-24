import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
} from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";
import { from, of } from "rxjs";
import { map, switchMap } from "rxjs/operators";
import { AppConfig } from "../environments/environment";
import { ConfirmDialogComponent } from "./components/confirm-dialog/confirm-dialog.component";
import { TelemetryDialogComponent } from "./components/telemetry-dialog/telemetry-dialog.component";
import { ElectronService } from "./services";
import { AddonService } from "./services/addons/addon.service";
import { AnalyticsService } from "./services/analytics/analytics.service";
import { FileService } from "./services/files/file.service";
import { WarcraftService } from "./services/warcraft/warcraft.service";
import { WowUpService } from "./services/wowup/wowup.service";

const AUTO_UPDATE_PERIOD_MS = 60 * 60 * 1000; // 1 hour

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements AfterViewInit {
  private _autoUpdateInterval?: number;

  public showTitleBar: boolean = true;

  constructor(
    private _analyticsService: AnalyticsService,
    private _electronService: ElectronService,
    private _fileService: FileService,
    private translate: TranslateService,
    private warcraft: WarcraftService,
    private _wowUpService: WowUpService,
    private _dialog: MatDialog,
    private _addonService: AddonService
  ) {
    this.translate.setDefaultLang("en");

    this.translate.use(this._electronService.locale);

    this.showTitleBar = !this._electronService.isLinux;
  }

  ngAfterViewInit(): void {
    this.onAutoUpdateInterval();
    this._autoUpdateInterval = window.setInterval(
      this.onAutoUpdateInterval,
      AUTO_UPDATE_PERIOD_MS
    );
  }

  private onAutoUpdateInterval = async () => {
    console.log("Auto update");
    const updateCount = await this._addonService.processAutoUpdates();

    if (updateCount === 0) {
      return;
    }

    const iconPath = await this._fileService.getAssetFilePath(
      "wowup_logo_512np.png"
    );

    if (this._wowUpService.enableSystemNotifications) {
      this._electronService.showNotification("Auto Updates", {
        body: `Automatically updated ${updateCount} addons.`,
        icon: iconPath,
      });
    }
  };
}
