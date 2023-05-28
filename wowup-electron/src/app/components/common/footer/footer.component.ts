import { combineLatest, from, Observable, of } from "rxjs";
import { catchError, map, switchMap } from "rxjs/operators";

import { Component, NgZone, OnInit } from "@angular/core";
import { MatLegacyDialog as MatDialog } from "@angular/material/legacy-dialog";
import { TranslateService } from "@ngx-translate/core";

import { TAB_INDEX_ABOUT } from "../../../../common/constants";
import { AppUpdateState } from "../../../../common/wowup/models";
import { AppConfig } from "../../../../environments/environment";
import { ElectronService } from "../../../services";
import { LinkService } from "../../../services/links/link.service";
import { SessionService } from "../../../services/session/session.service";
import { WowUpService } from "../../../services/wowup/wowup.service";
import { ConfirmDialogComponent } from "../../common/confirm-dialog/confirm-dialog.component";

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
  public appUpdateState = AppUpdateState;

  public appUpdateState$: Observable<AppUpdateState> = this.electronService.appUpdate$.pipe(map((evt) => evt.state));
  public accountDisplayName$: Observable<string> = this.sessionService.wowUpAccount$.pipe(
    map((account) => account?.displayName ?? "")
  );

  public appUpdateProgress$: Observable<number> = combineLatest([
    of(0),
    this.electronService.appUpdate$.pipe(map((evt) => evt.progress?.percent ?? 0)),
  ]).pipe(map(([def, val]) => Math.max(def, val)));

  public constructor(
    private _dialog: MatDialog,
    private _translateService: TranslateService,
    private _zone: NgZone,
    public wowUpService: WowUpService,
    public sessionService: SessionService,
    private electronService: ElectronService,
    private _wowupService: WowUpService,
    private _linkService: LinkService
  ) {}

  public ngOnInit(): void {
    // Force the angular zone to pump for every progress update since its outside the zone
    this.sessionService.statusText$.subscribe(() => {
      this._zone.run(() => {});
    });

    this.sessionService.pageContextText$.subscribe(() => {
      this._zone.run(() => {});
    });
  }

  public onClickCheckForUpdates(): void {
    this.wowUpService.checkForAppUpdate();
  }

  public onClickAccount(): void {
    this.sessionService.selectedHomeTab = TAB_INDEX_ABOUT;
  }

  private portableUpdate() {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant("APP.WOWUP_UPDATE.PORTABLE_DOWNLOAD_TITLE"),
        message: this._translateService.instant("APP.WOWUP_UPDATE.PORTABLE_DOWNLOAD_MESSAGE"),
      },
    });

    dialogRef
      .afterClosed()
      .pipe(
        switchMap((result) => {
          if (!result) {
            return of(undefined);
          }

          return from(
            this._linkService.openExternalLink(
              `${AppConfig.wowupRepositoryUrl}/releases/tag/v${this.wowUpService.availableVersion}`
            )
          );
        }),
        catchError((e) => {
          console.error(e);
          return of(undefined);
        })
      )
      .subscribe();

    return;
  }

  public onClickInstallUpdate(): void {
    this._wowupService.installUpdate();
  }

  // public async onClickUpdateWowup(): Promise<void> {
  //   if (!this.isWowUpUpdateAvailable) {
  //     return;
  //   }

  //   if (this.electronService.isPortable) {
  //     this.portableUpdate();
  //     return;
  //   }

  //   if (this.isWowUpUpdateDownloaded) {
  //     const dialogRef = this._dialog.open(ConfirmDialogComponent, {
  //       data: {
  //         title: this._translateService.instant("APP.WOWUP_UPDATE.INSTALL_TITLE"),
  //         message: this._translateService.instant("APP.WOWUP_UPDATE.INSTALL_MESSAGE"),
  //       },
  //     });

  //     dialogRef
  //       .afterClosed()
  //       .pipe(
  //         switchMap((result) => {
  //           if (!result) {
  //             return of(undefined);
  //           }
  //           return from(this.wowUpService.installUpdate());
  //         }),
  //         catchError((e) => {
  //           console.error(e);
  //           return of(undefined);
  //         })
  //       )
  //       .subscribe();

  //     return;
  //   }

  //   this.isUpdatingWowUp = true;
  //   try {
  //     await this.wowUpService.downloadUpdate();
  //   } catch (e) {
  //     console.error("onClickUpdateWowup", e);
  //   } finally {
  //     this.isUpdatingWowUp = false;
  //   }
  // }
}
