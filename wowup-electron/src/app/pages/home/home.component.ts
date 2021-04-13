import { from, Subscription } from "rxjs";
import { filter, first, map, switchMap, tap } from "rxjs/operators";

import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { TranslateService } from "@ngx-translate/core";

import {
  APP_PROTOCOL_NAME,
  CURSE_PROTOCOL_NAME,
  IPC_POWER_MONITOR_RESUME,
  IPC_POWER_MONITOR_UNLOCK,
} from "../../../common/constants";
import { AppConfig } from "../../../environments/environment";
import { InstallFromProtocolDialogComponent } from "../../components/install-from-protocol-dialog/install-from-protocol-dialog.component";
import { AddonScanError } from "../../errors";
import { WowInstallation } from "../../models/wowup/wow-installation";
import { ElectronService } from "../../services";
import { AddonService, ScanUpdate, ScanUpdateType } from "../../services/addons/addon.service";
import { DialogFactory } from "../../services/dialog/dialog.factory";
import { SessionService } from "../../services/session/session.service";
import { WarcraftInstallationService } from "../../services/warcraft/warcraft-installation.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { getProtocol } from "../../utils/string.utils";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { SnackbarService } from "../../services/snackbar/snackbar.service";

@Component({
  selector: "app-home",
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  private _appUpdateInterval?: number;
  private _subscriptions: Subscription[] = [];

  public selectedIndex = 0;
  public hasWowClient = false;
  public appReady = false;
  public preloadSpinnerKey = "COMMON.PROGRESS_SPINNER.LOADING";

  public constructor(
    public electronService: ElectronService,
    private _sessionService: SessionService,
    private _translateService: TranslateService,
    private _addonService: AddonService,
    private _wowupService: WowUpService,
    private _snackBar: MatSnackBar,
    private _snackBarService: SnackbarService,
    private _cdRef: ChangeDetectorRef,
    private _warcraftInstallationService: WarcraftInstallationService,
    private _dialogFactory: DialogFactory
  ) {
    const wowInstalledSub = this._warcraftInstallationService.wowInstallations$.subscribe((installations) => {
      this.hasWowClient = installations.length > 0;
      this.selectedIndex = this.hasWowClient ? 0 : 3;
    });

    const customProtocolSub = this.electronService.customProtocol$
      .pipe(
        filter((protocol) => !!protocol),
        switchMap((protocol) => from(this.handleCustomProtocol(protocol)))
      )
      .subscribe();

    const scanErrorSub = this._addonService.scanError$.subscribe(this.onAddonScanError);
    const addonInstallErrorSub = this._addonService.addonInstalled$.subscribe(this.onAddonInstalledEvent);

    const scanUpdateSub = this._addonService.scanUpdate$
      .pipe(filter((update) => update.type !== ScanUpdateType.Unknown))
      .subscribe(this.onScanUpdate);

    this._subscriptions.push(customProtocolSub, wowInstalledSub, scanErrorSub, scanUpdateSub, addonInstallErrorSub);
  }

  private handleCustomProtocol = async (protocol: string): Promise<void> => {
    console.debug("PROTOCOL RECEIEVED", protocol);
    const protocolName = getProtocol(protocol);
    try {
      switch (protocolName) {
        case APP_PROTOCOL_NAME:
        case CURSE_PROTOCOL_NAME:
          await this.handleAddonInstallProtocol(protocol);
          break;
        default:
          console.warn(`Unknown protocol: ${protocol}`);
          return;
      }
    } catch (e) {
      console.error(`Failed to handle protocol`, e);
    }
  };

  private async handleAddonInstallProtocol(protocol: string) {
    const dialog = this._dialogFactory.getDialog(InstallFromProtocolDialogComponent, {
      disableClose: true,
      data: {
        protocol,
      },
    });

    await dialog.afterClosed().toPromise();
  }

  public ngAfterViewInit(): void {
    const powerMonitorSub = this.electronService.powerMonitor$.pipe(filter((evt) => !!evt)).subscribe((evt) => {
      console.log("Stopping app update check...");
      this.destroyAppUpdateCheck();

      if (evt === IPC_POWER_MONITOR_RESUME || evt === IPC_POWER_MONITOR_UNLOCK) {
        this.initAppUpdateCheck();
      }
    });

    const wowInstallInitialSub = this._warcraftInstallationService.wowInstallations$
      .pipe(
        first(),
        switchMap((installations) => {
          return from(this.migrateAddons(installations)).pipe(map(() => installations));
        })
      )
      .subscribe(() => {
        this.appReady = true;
        this.detectChanges();
      });

    this.initAppUpdateCheck();

    this._subscriptions.push(powerMonitorSub, wowInstallInitialSub);
  }

  public ngOnDestroy(): void {
    window.clearInterval(this._appUpdateInterval);
    this._subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private initAppUpdateCheck() {
    if (this._appUpdateInterval !== undefined) {
      console.warn(`App update interval already exists`);
      return;
    }

    // check for an app update every so often
    this._appUpdateInterval = window.setInterval(() => {
      this.checkForAppUpdate().catch((e) => console.error(e));
    }, AppConfig.appUpdateIntervalMs);

    this.checkForAppUpdate().catch((e) => console.error(e));
  }

  private destroyAppUpdateCheck() {
    window.clearInterval(this._appUpdateInterval);
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

  public onSelectedIndexChange(index: number): void {
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

  private onAddonInstalledEvent = (evt: AddonUpdateEvent) => {
    if (evt.installState !== AddonInstallState.Error) {
      return;
    }

    this._snackBarService.showErrorSnackbar("COMMON.ERRORS.ADDON_INSTALL_ERROR", {
      localeArgs: {
        addonName: evt.addon.name,
      },
    });
  };
}
