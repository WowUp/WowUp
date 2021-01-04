import { ChangeDetectorRef, Component, NgZone, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { TranslateService } from "@ngx-translate/core";
import { ElectronService } from "../../services";
import { UpdateCheckResult } from "electron-updater";
import { AppConfig } from "../../../environments/environment";
import { SessionService } from "../../services/session/session.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";
import {
  CenteredSnackbarComponent,
  CenteredSnackbarComponentData,
} from "../centered-snackbar/centered-snackbar.component";
import { from } from "rxjs";

@Component({
  selector: "app-footer",
  templateUrl: "./footer.component.html",
  styleUrls: ["./footer.component.scss"],
})
export class FooterComponent implements OnInit {
  public isUpdatingWowUp = false;
  public isWowUpUpdateAvailable = false;
  public isWowUpUpdateDownloaded = false;
  public isCheckingForUpdates = false;
  public isWowUpdateDownloading = false;
  public updateIconTooltip = "APP.WOWUP_UPDATE.TOOLTIP";
  public versionNumber = from(this.wowUpService.getApplicationVersion());

  constructor(
    private _dialog: MatDialog,
    private _translateService: TranslateService,
    private _zone: NgZone,
    private _cdRef: ChangeDetectorRef,
    public wowUpService: WowUpService,
    public sessionService: SessionService,
    private _snackBar: MatSnackBar,
    private _electronService: ElectronService
  ) {}

  ngOnInit(): void {
    this.wowUpService.wowupUpdateCheck$.subscribe((updateCheckResult) => {
      console.debug("updateCheckResult", updateCheckResult);
      this.isWowUpUpdateAvailable = true;
      this._cdRef.detectChanges();
    });

    this.wowUpService.wowupUpdateDownloaded$.subscribe((result) => {
      console.debug("wowupUpdateDownloaded", result);
      this._zone.run(() => {
        this.isWowUpUpdateDownloaded = true;
        this.updateIconTooltip = "APP.WOWUP_UPDATE.DOWNLOADED_TOOLTIP";
        this.onClickUpdateWowup();
      });
    });

    this.wowUpService.wowupUpdateCheckInProgress$.subscribe((inProgress) => {
      console.debug("wowUpUpdateCheckInProgress", inProgress);
      this.isCheckingForUpdates = inProgress;
      this._cdRef.detectChanges();
    });

    this.wowUpService.wowupUpdateDownloadInProgress$.subscribe((inProgress) => {
      console.debug("wowupUpdateDownloadInProgress", inProgress);
      this.isWowUpdateDownloading = inProgress;
      this._cdRef.detectChanges();
    });

    // Force the angular zone to pump for every progress update since its outside the zone
    this.sessionService.statusText$.subscribe((text) => {
      this._zone.run(() => {});
    });

    this.sessionService.pageContextText$.subscribe((text) => {
      this._zone.run(() => {});
    });
  }

  public async onClickCheckForUpdates(): Promise<void> {
    if (this.isCheckingForUpdates) {
      return;
    }

    let result: UpdateCheckResult = null;
    try {
      result = await this.wowUpService.checkForAppUpdate();

      if (result === null || (await this.wowUpService.isSameVersion(result))) {
        this.showSnackbar("APP.WOWUP_UPDATE.NOT_AVAILABLE");
      }
    } catch (e) {
      console.error(e);
      this.showSnackbar("APP.WOWUP_UPDATE.UPDATE_ERROR", ["snackbar-error"]);
    }
  }

  private showSnackbar(localeKey: string, classes: string[] = []) {
    const message = this._translateService.instant(localeKey);
    const data: CenteredSnackbarComponentData = {
      message,
    };
    this._snackBar.openFromComponent(CenteredSnackbarComponent, {
      duration: 5000,
      panelClass: ["wowup-snackbar", "text-1", ...classes],
      data,
    });
  }

  private portableUpdate() {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant("APP.WOWUP_UPDATE.PORTABLE_DOWNLOAD_TITLE"),
        message: this._translateService.instant("APP.WOWUP_UPDATE.PORTABLE_DOWNLOAD_MESSAGE"),
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }

      this._electronService.openExternal(
        `${AppConfig.wowupRepositoryUrl}/releases/tag/v${this.wowUpService.availableVersion}`
      );
    });

    return;
  }

  public async onClickUpdateWowup() {
    if (!this.isWowUpUpdateAvailable) {
      return;
    }

    if (this._electronService.isPortable) {
      this.portableUpdate();
      return;
    }

    if (this.isWowUpUpdateDownloaded) {
      const dialogRef = this._dialog.open(ConfirmDialogComponent, {
        data: {
          title: this._translateService.instant("APP.WOWUP_UPDATE.INSTALL_TITLE"),
          message: this._translateService.instant("APP.WOWUP_UPDATE.INSTALL_MESSAGE"),
        },
      });

      dialogRef.afterClosed().subscribe((result) => {
        if (!result) {
          return;
        }
        this.wowUpService.installUpdate();
      });

      return;
    }

    this.isUpdatingWowUp = true;
    try {
      await this.wowUpService.downloadUpdate();
    } catch (e) {
      console.error("onClickUpdateWowup", e);
    } finally {
      this.isUpdatingWowUp = false;
    }
  }
}
