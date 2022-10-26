import { HttpErrorResponse } from "@angular/common/http";
import { Component, OnDestroy } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { from, Subscription } from "rxjs";
import { AddonSearchResult } from "../../../models/wowup/addon-search-result";
import { AddonService } from "../../../services/addons/addon.service";
import { SessionService } from "../../../services/session/session.service";
import { AlertDialogComponent } from "../../common/alert-dialog/alert-dialog.component";
import { TranslateService } from "@ngx-translate/core";
import { roundDownloadCount, shortenDownloadCount } from "../../../utils/number.utils";
import { DownloadCountPipe } from "../../../pipes/download-count.pipe";
import { NO_SEARCH_RESULTS_ERROR } from "../../../../common/constants";
import { AssetMissingError, GitHubLimitError, NoReleaseFoundError } from "../../../errors";
import { SearchByUrlResult } from "../../../addon-providers/addon-provider";
import { WowClientGroup } from "../../../../common/warcraft/wow-client-type";

interface DownloadCounts {
  count: number;
  shortCount: number;
  simpleCount: string;
  myriadCount: string;
  textCount: string;
  provider: string;
}

@Component({
  selector: "app-install-from-url-dialog",
  templateUrl: "./install-from-url-dialog.component.html",
  styleUrls: ["./install-from-url-dialog.component.scss"],
})
export class InstallFromUrlDialogComponent implements OnDestroy {
  public isBusy = false;
  public showInstallSpinner = false;
  public showInstallButton = false;
  public showInstallSuccess = false;
  public query = "";
  public addon?: AddonSearchResult;
  public hasThumbnail = false;
  public thumbnailLetter = "";

  private _installSubscription?: Subscription;

  public constructor(
    private _addonService: AddonService,
    private _dialog: MatDialog,
    private _sessionService: SessionService,
    private _translateService: TranslateService,
    private _downloadCountPipe: DownloadCountPipe,
    public dialogRef: MatDialogRef<InstallFromUrlDialogComponent>
  ) {}

  public ngOnDestroy(): void {
    this._installSubscription?.unsubscribe();
  }

  public onClose(): void {
    this.dialogRef.close();
  }

  public onClearSearch(): void {
    this.query = "";
    this.onImportUrl().catch((error) => console.error(error));
  }

  public onInstall(): void {
    const selectedInstallation = this._sessionService.getSelectedWowInstallation();
    if (!selectedInstallation || !this.addon) {
      return;
    }

    this.showInstallButton = false;
    this.showInstallSpinner = true;

    this._installSubscription = from(
      this._addonService.installPotentialAddon(this.addon, selectedInstallation, undefined, this.addon.files[0])
    ).subscribe({
      next: () => {
        this.showInstallSpinner = false;
        this.showInstallSuccess = true;
      },
      error: (err) => {
        console.error(err);
        this.showInstallSpinner = false;
        this.showInstallButton = true;
        this.showErrorMessage(
          this._translateService.instant("DIALOGS.INSTALL_FROM_URL.ERROR.INSTALL_FAILED") as string
        );
      },
    });
  }

  public getDownloadCountParams(): DownloadCounts {
    const count = this.addon?.downloadCount ?? 0;
    return {
      count,
      shortCount: roundDownloadCount(count),
      simpleCount: shortenDownloadCount(count, 1),
      myriadCount: shortenDownloadCount(count, 4),
      textCount: this._downloadCountPipe.transform(count),
      provider: this.addon?.providerName ?? "",
    };
  }

  public async onImportUrl(): Promise<void> {
    this.addon = undefined;
    this.showInstallSuccess = false;
    this.showInstallSpinner = false;
    this.hasThumbnail = false;
    this.thumbnailLetter = "";

    if (!this.query) {
      return;
    }

    const url: URL | undefined = this.getUrlFromQuery();
    if (!url) {
      return;
    }

    try {
      const selectedInstallation = this._sessionService.getSelectedWowInstallation();
      if (!selectedInstallation) {
        throw new Error(`Selected installation not found`);
      }

      const searchByUrlResult = await this._addonService.getAddonByUrl(url, selectedInstallation);
      if (!searchByUrlResult) {
        throw new Error("Addon not found");
      }

      this.addon = searchByUrlResult.searchResult;
      this.hasThumbnail = !!this.addon.thumbnailUrl;
      this.thumbnailLetter = this.addon.name.charAt(0).toUpperCase();

      const addonInstalled = await this._addonService.isInstalled(
        this.addon.externalId,
        this.addon.providerName,
        selectedInstallation
      );

      this.handleImportErrors(searchByUrlResult);

      if (addonInstalled) {
        this.showInstallSuccess = true;
        this.showInstallButton = false;
        return;
      }

      this.showInstallButton = true;
    } catch (err) {
      console.error(err);

      let message: string = err.message;
      if (err instanceof HttpErrorResponse) {
        message = this._translateService.instant("DIALOGS.INSTALL_FROM_URL.ERROR.NO_ADDON_FOUND");
      } else if (err.code && err.code === "EOPENBREAKER") {
        // Provider circuit breaker is open
        message = this._translateService.instant("DIALOGS.INSTALL_FROM_URL.ERROR.FAILED_TO_CONNECT");
      } else if (message === NO_SEARCH_RESULTS_ERROR) {
        message = this._translateService.instant("DIALOGS.INSTALL_FROM_URL.ERROR.NO_SEARCH_RESULTS");
      } else if (err instanceof AssetMissingError) {
        let key = "ERROR.ASSET_NOT_FOUND";
        switch (err.clientGroup) {
          case WowClientGroup.BurningCrusade:
            key = "DIALOGS.INSTALL_FROM_URL.ERROR.BURNING_CRUSADE_ASSET_NOT_FOUND";
            break;
          case WowClientGroup.Classic:
            key = "DIALOGS.INSTALL_FROM_URL.ERROR.CLASSIC_ASSET_NOT_FOUND";
            break;
          case WowClientGroup.WOTLK:
            key = "DIALOGS.INSTALL_FROM_URL.ERROR.WRATH_ASSET_NOT_FOUND";
            break;
          case WowClientGroup.Retail:
          default:
        }
        message = this._translateService.instant(key, {
          message: err.message,
        });
      } else if (err instanceof NoReleaseFoundError) {
        message = this._translateService.instant("DIALOGS.INSTALL_FROM_URL.ERROR.NO_RELEASE_FOUND", {
          message: err.message,
        });
      } else if (err instanceof GitHubLimitError) {
        const max = err.rateLimitMax;
        const reset = new Date(err.rateLimitReset * 1000).toLocaleString();
        message = this._translateService.instant("COMMON.ERRORS.GITHUB_LIMIT_ERROR", {
          max,
          reset,
        });
      }

      this.showErrorMessage(message);
    }
  }

  private handleImportErrors(result: SearchByUrlResult) {
    if (!Array.isArray(result.errors)) {
      return;
    }

    for (const error of result.errors) {
      if (error instanceof AssetMissingError) {
        const message: string = this._translateService.instant("DIALOGS.INSTALL_FROM_URL.IMPORT_ASSET_WARNING", {
          zipName: result.searchResult.files[0].version,
        });
        const title: string = this._translateService.instant("DIALOGS.INSTALL_FROM_URL.IMPORT_WARNING_TITLE");

        this.showErrorMessage(message, title);
      }
    }
  }

  private getUrlFromQuery(): URL | undefined {
    try {
      return new URL(this.query);
    } catch (err) {
      console.error(`Invalid url: ${this.query}`);
      this.showErrorMessage(this._translateService.instant("DIALOGS.INSTALL_FROM_URL.ERROR.INVALID_URL") as string);
      return undefined;
    }
  }

  private showErrorMessage(errorMessage: string, title?: string) {
    const dialogRef = this._dialog.open(AlertDialogComponent, {
      minWidth: 250,
      data: {
        title: title || this._translateService.instant("DIALOGS.INSTALL_FROM_URL.ERROR.TITLE"),
        message: errorMessage,
        positiveButtonStyle: "raised",
        positiveButtonColor: "primary",
      },
    });
    dialogRef.afterClosed().subscribe();
  }
}
