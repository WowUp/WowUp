import { HttpErrorResponse } from "@angular/common/http";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { from, Subscription } from "rxjs";
import { AddonSearchResult } from "../../models/wowup/addon-search-result";
import { AddonService } from "../../services/addons/addon.service";
import { SessionService } from "../../services/session/session.service";
import { AlertDialogComponent } from "../alert-dialog/alert-dialog.component";
import { TranslateService } from "@ngx-translate/core";
import { roundDownloadCount, shortenDownloadCount } from "../../utils/number.utils";
import { DownloadCountPipe } from "../../pipes/download-count.pipe";

@Component({
  selector: "app-install-from-url-dialog",
  templateUrl: "./install-from-url-dialog.component.html",
  styleUrls: ["./install-from-url-dialog.component.scss"],
})
export class InstallFromUrlDialogComponent implements OnInit, OnDestroy {
  public isBusy = false;
  public showInstallSpinner = false;
  public showInstallButton = false;
  public showInstallSuccess = false;
  public query = "";
  public addon?: AddonSearchResult;

  private _installSubscription?: Subscription;

  constructor(
    private _addonService: AddonService,
    private _dialog: MatDialog,
    private _sessionService: SessionService,
    private _translateService: TranslateService,
    private _downloadCountPipe: DownloadCountPipe,
    public dialogRef: MatDialogRef<InstallFromUrlDialogComponent>
  ) {}

  ngOnInit(): void {}

  ngOnDestroy() {
    this._installSubscription?.unsubscribe();
  }

  onClose() {
    this.dialogRef.close();
  }

  onClearSearch() {
    this.query = "";
    this.onImportUrl();
  }

  onInstall() {
    this.showInstallButton = false;
    this.showInstallSpinner = true;

    this._installSubscription = from(
      this._addonService.installPotentialAddon(this.addon, this._sessionService.selectedClientType)
    ).subscribe({
      next: () => {
        this.showInstallSpinner = false;
        this.showInstallSuccess = true;
      },
      error: (err) => {
        console.error(err);
        this.showInstallSpinner = false;
        this.showInstallButton = true;
        this.showErrorMessage(this._translateService.instant("DIALOGS.INSTALL_FROM_URL.ERROR.INSTALL_FAILED"));
      },
    });
  }

  public getDownloadCountParams() {
    const count = this.addon.downloadCount;
    return {
      count,
      shortCount: roundDownloadCount(count),
      simpleCount: shortenDownloadCount(count, 1),
      myriadCount: shortenDownloadCount(count, 4),
      textCount: this._downloadCountPipe.transform(count),
      provider: this.addon.providerName,
    };
  }

  async onImportUrl() {
    this.addon = undefined;
    this.showInstallSuccess = false;
    this.showInstallSpinner = false;

    if (!this.query) {
      return;
    }

    const url: URL = this.getUrlFromQuery();
    if (!url) {
      return;
    }

    try {
      const importedAddon = await this._addonService.getAddonByUrl(url, this._sessionService.selectedClientType);

      console.debug(importedAddon);
      if (!importedAddon) {
        throw new Error("Addon not found");
      }

      this.addon = importedAddon;

      if (this.addonExists(importedAddon.externalId)) {
        this.showInstallSuccess = true;
        this.showInstallButton = false;
        return;
      }

      this.showInstallButton = true;
    } catch (err) {
      console.error(err);

      let message = err.message;
      if (err instanceof HttpErrorResponse) {
        message = this._translateService.instant("DIALOGS.INSTALL_FROM_URL.ERROR.NO_ADDON_FOUND");
      } else if (err.code && err.code === "EOPENBREAKER") {
        // Provider circuit breaker is open
        message = this._translateService.instant("DIALOGS.INSTALL_FROM_URL.ERROR.FAILED_TO_CONNECT");
      }

      this.showErrorMessage(message);
    }
  }

  private addonExists(externalId: string) {
    return this._addonService.isInstalled(externalId, this._sessionService.selectedClientType);
  }

  private getUrlFromQuery(): URL | undefined {
    try {
      return new URL(this.query);
    } catch (err) {
      console.error(`Invalid url: ${this.query}`);
      this.showErrorMessage(this._translateService.instant("DIALOGS.INSTALL_FROM_URL.ERROR.INVALID_URL"));
      return undefined;
    }
  }

  private showErrorMessage(errorMessage: string) {
    const dialogRef = this._dialog.open(AlertDialogComponent, {
      minWidth: 250,
      data: {
        title: this._translateService.instant("DIALOGS.INSTALL_FROM_URL.ERROR.TITLE"),
        message: errorMessage,
      },
    });
    dialogRef.afterClosed().subscribe();
  }
}
