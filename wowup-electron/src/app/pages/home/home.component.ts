import { AfterViewInit, ChangeDetectionStrategy, Component } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { TranslateService } from "@ngx-translate/core";
import { AddonService, ScanUpdate, ScanUpdateType } from "../../services/addons/addon.service";
import { filter } from "rxjs/operators";
import { ElectronService } from "../../services";
import { SessionService } from "../../services/session/session.service";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { WowUpService } from "../../services/wowup/wowup.service";

@Component({
  selector: "app-home",
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements AfterViewInit {
  public selectedIndex = 0;
  public hasWowClient = false;

  constructor(
    public electronService: ElectronService,
    private _sessionService: SessionService,
    private _snackBar: MatSnackBar,
    private _translateService: TranslateService,
    private _addonService: AddonService,
    private _warcraftService: WarcraftService,
    private _wowupService: WowUpService
  ) {
    this._warcraftService.installedClientTypes$.subscribe((clientTypes) => {
      if (clientTypes === undefined) {
        this.hasWowClient = false;
        this.selectedIndex = 3;
      } else {
        this.hasWowClient = clientTypes.length > 0;
        this.selectedIndex = this.hasWowClient ? 0 : 3;
      }
    });

    this._addonService.scanUpdate$
      .pipe(filter((update) => update.type !== ScanUpdateType.Unknown))
      .subscribe(this.onScanUpdate);
  }

  ngAfterViewInit(): void {
    // check for an app update every hour
    window.setInterval(() => {
      this.checkForAppUpdate();
    }, 60 * 60 * 1000);

    this.checkForAppUpdate();
  }

  onSelectedIndexChange(index: number) {
    this._sessionService.selectedHomeTab = index;
  }

  private onScanUpdate = (update: ScanUpdate) => {
    switch (update.type) {
      case ScanUpdateType.Start:
        this._sessionService.statusText = this._translateService.instant("APP.STATUS_TEXT.ADDON_SCAN_STARTED");
        break;
      case ScanUpdateType.Complete:
        this._sessionService.statusText = this._translateService.instant("APP.STATUS_TEXT.ADDON_SCAN_COMPLETED");
        window.setTimeout(() => {
          this._sessionService.statusText = "";
        }, 3000);
        break;
      case ScanUpdateType.Update:
        this._sessionService.statusText = this._translateService.instant("APP.STATUS_TEXT.ADDON_SCAN_UPDATE", {
          count: update.totalCount,
        });
        break;
      default:
        break;
    }
  };

  private async checkForAppUpdate() {
    try {
      const appUpdateResponse = await this._wowupService.checkForAppUpdate();
      console.log(appUpdateResponse);
    } catch (e) {
      console.error(e);
    }
  }
}
