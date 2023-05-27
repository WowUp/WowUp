import { Component } from "@angular/core";
import { MatLegacySlideToggleChange as MatSlideToggleChange } from "@angular/material/legacy-slide-toggle";
import { TranslateService } from "@ngx-translate/core";
import { of } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { AppConfig } from "../../../environments/environment";
import { ElectronService } from "../../services";
import { DialogFactory } from "../../services/dialog/dialog.factory";
import { LinkService } from "../../services/links/link.service";
import { SessionService } from "../../services/session/session.service";
import { SnackbarService } from "../../services/snackbar/snackbar.service";
import { WowUpService } from "../../services/wowup/wowup.service";

@Component({
  selector: "app-account-page",
  templateUrl: "./account-page.component.html",
  styleUrls: ["./account-page.component.scss"],
})
export class AccountPageComponent {
  public constructor(
    public electronService: ElectronService,
    public sessionService: SessionService,
    public wowUpService: WowUpService,
    private _dialogFactory: DialogFactory,
    private _translateService: TranslateService,
    private _snackbarService: SnackbarService,
    private _linkService: LinkService
  ) {}

  public onClickLogin(): void {
    this.sessionService.login();
  }

  public onToggleAccountPush = async (evt: MatSlideToggleChange): Promise<void> => {
    try {
      await this.sessionService.toggleAccountPush(evt.checked);
    } catch (e) {
      evt.source.checked = !evt.source.checked;
      console.error("Failed to toggle account push", e);
      this._snackbarService.showErrorSnackbar("COMMON.ERRORS.ACCOUNT_PUSH_TOGGLE_FAILED_ERROR");
    }
  };

  public onClickLogout(): void {
    const title: string = this._translateService.instant("PAGES.ACCOUNT.LOGOUT_CONFIRMATION_TITLE");
    const message: string = this._translateService.instant("PAGES.ACCOUNT.LOGOUT_CONFIRMATION_MESSAGE");

    const dialogRef = this._dialogFactory.getConfirmDialog(title, message);

    dialogRef
      .afterClosed()
      .pipe(
        map((result) => {
          if (result) {
            this.sessionService.logout();
          }
        }),
        catchError((error) => {
          console.error(error);
          return of(undefined);
        })
      )
      .subscribe();
  }

  public onClickManageAccount(): void {
    this._linkService.openExternalLink(`${AppConfig.wowUpWebsiteUrl}/account`).catch((e) => console.error(e));
  }
}
