import { from, interval, Subscription } from "rxjs";
import { filter, first, switchMap, tap } from "rxjs/operators";

import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, NgZone, OnDestroy } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { TranslateService } from "@ngx-translate/core";

import { IPC_POWER_MONITOR_RESUME, IPC_POWER_MONITOR_UNLOCK } from "../../../common/constants";
import { AppConfig } from "../../../environments/environment";
import { AddonScanError } from "../../errors";
import { WowInstallation } from "../../models/wowup/wow-installation";
import { ElectronService } from "../../services";
import { AddonService, ScanUpdate, ScanUpdateType } from "../../services/addons/addon.service";
import { SessionService } from "../../services/session/session.service";
import { WarcraftInstallationService } from "../../services/warcraft/warcraft-installation.service";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { WowUpService } from "../../services/wowup/wowup.service";

@Component({
  selector: "app-home",
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  private _appUpdateInterval: Subscription;

  public selectedIndex = 0;
  public hasWowClient = false;
  public appReady = false;
  public preloadSpinnerKey = "COMMON.PROGRESS_SPINNER.LOADING";

  constructor(
    public electronService: ElectronService,
    private _sessionService: SessionService,
    private _translateService: TranslateService,
    private _addonService: AddonService,
    private _wowupService: WowUpService,
    private _snackBar: MatSnackBar,
    private _cdRef: ChangeDetectorRef,
    private _warcraftInstallationService: WarcraftInstallationService
  ) {
    this._warcraftInstallationService.wowInstallations$.subscribe((installations) => {
      this.hasWowClient = installations.length > 0;
      this.selectedIndex = this.hasWowClient ? 0 : 3;
    });

    this._addonService.scanError$.subscribe(this.onAddonScanError);

    this._addonService.scanUpdate$
      .pipe(filter((update) => update.type !== ScanUpdateType.Unknown))
      .subscribe(this.onScanUpdate);
  }

  ngAfterViewInit(): void {
    this.electronService.powerMonitor$.pipe(filter((evt) => !!evt)).subscribe((evt) => {
      console.log("Stopping app update check...");
      this.destroyAppUpdateCheck();

      if (evt === IPC_POWER_MONITOR_RESUME || evt === IPC_POWER_MONITOR_UNLOCK) {
        this.initAppUpdateCheck();
      }
    });

    this.initAppUpdateCheck();

    this._warcraftInstallationService.wowInstallations$
      .pipe(first((installations) => installations.length > 0))
      .subscribe(() => {
        this.appReady = true;
        this.detectChanges();
      });
  }

  ngOnDestroy(): void {
    this._appUpdateInterval?.unsubscribe();
  }

  private initAppUpdateCheck() {
    // check for an app update every so often
    this._appUpdateInterval = interval(AppConfig.appUpdateIntervalMs)
      .pipe(
        tap(() => {
          this.checkForAppUpdate().catch((e) => console.error(e));
        })
      )
      .subscribe();

    this.checkForAppUpdate().catch((e) => console.error(e));
  }

  private destroyAppUpdateCheck() {
    this._appUpdateInterval?.unsubscribe();
    this._appUpdateInterval = undefined;
  }

  private async migrateAddons(installations: WowInstallation[]) {
    const shouldMigrate = await this._wowupService.shouldMigrateAddons();
    if (!installations || installations.length === 0 || !shouldMigrate) {
      return installations;
    }

    this.preloadSpinnerKey = "PAGES.HOME.MIGRATING_ADDONS";
    this.detectChanges();

    console.log("Migrating addons");

    try {
      for (const installation of installations) {
        await this._addonService.migrate(installation);
      }

      await this._wowupService.setMigrationVersion();
    } catch (e) {
      console.error(`Failed to migrate addons`, e);
    }

    return installations;
  }

  private detectChanges = () => {
    try {
      this._cdRef.detectChanges();
    } catch (e) {
      console.warn(e);
    }
  };

  onSelectedIndexChange(index: number): void {
    this._sessionService.selectedHomeTab = index;
  }

  private onAddonScanError = (error: AddonScanError) => {
    const durationMs = 4000;
    const errorMessage = this._translateService.instant("COMMON.ERRORS.ADDON_SCAN_ERROR", {
      providerName: error.providerName,
    });

    this._snackBar.open(errorMessage, undefined, {
      duration: durationMs,
      panelClass: ["wowup-snackbar", "snackbar-error", "text-1"],
    });
  };

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
