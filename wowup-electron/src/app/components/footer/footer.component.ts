import { Component, NgZone, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";
import { SessionService } from "../../services/session/session.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";

@Component({
  selector: "app-footer",
  templateUrl: "./footer.component.html",
  styleUrls: ["./footer.component.scss"],
})
export class FooterComponent implements OnInit {
  public isUpdatingWowUp = false;
  public isWowUpUpdateAvailable = false;
  public isWowUpUpdateDownloaded = false;

  constructor(
    private _dialog: MatDialog,
    private _translateService: TranslateService,
    private _zone: NgZone,
    public wowUpService: WowUpService,
    public sessionService: SessionService
  ) {}

  ngOnInit(): void {
    this.wowUpService.wowupUpdateCheck$.subscribe((updateCheckResult) => {
      console.debug("updateCheckResult", updateCheckResult);
      this._zone.run(() => {
        this.isWowUpUpdateAvailable = true;
      });
    });

    this.wowUpService.wowupUpdateDownloaded$.subscribe((result) => {
      console.debug("wowupUpdateDownloaded", result);
      this._zone.run(() => {
        this.isWowUpUpdateDownloaded = true;
        this.onClickUpdateWowup();
      });
    });

    // Force the angular zone to pump for every progress update since its outside the zone
    this.sessionService.statusText$.subscribe((text) => {
      this._zone.run(() => {});
    });

    this.sessionService.pageContextText$.subscribe((text) => {
      this._zone.run(() => {});
    });
  }

  public getUpdateIconTooltip() {
    if (this.isWowUpUpdateDownloaded) {
      return "APP.WOWUP_UPDATE_DOWNLOADED_TOOLTIP";
    }

    if (this.isWowUpUpdateAvailable) {
      return "APP.WOWUP_UPDATE_TOOLTIP";
    }

    return "";
  }

  public async onClickUpdateWowup() {
    if (!this.isWowUpUpdateAvailable) {
      return;
    }

    if (this.isWowUpUpdateDownloaded) {
      const dialogRef = this._dialog.open(ConfirmDialogComponent, {
        data: {
          title: this._translateService.instant(
            "APP.WOWUP_UPDATE_INSTALL_TITLE"
          ),
          message: this._translateService.instant(
            "APP.WOWUP_UPDATE_INSTALL_MESSAGE"
          ),
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
