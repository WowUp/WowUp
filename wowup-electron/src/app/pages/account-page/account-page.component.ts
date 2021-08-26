import { Component, OnDestroy, OnInit } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { from, of, Subscription } from "rxjs";
import { catchError, filter, map, switchMap } from "rxjs/operators";
import { AppConfig } from "../../../environments/environment";
import { ElectronService } from "../../services";
import { DialogFactory } from "../../services/dialog/dialog.factory";
import { SessionService } from "../../services/session/session.service";
import { WowUpService } from "../../services/wowup/wowup.service";

@Component({
  selector: "app-account-page",
  templateUrl: "./account-page.component.html",
  styleUrls: ["./account-page.component.scss"],
})
export class AccountPageComponent {
  public displayName$ = this.sessionService.wowUpAccount$.pipe(map((account) => account?.displayName ?? ""));

  public constructor(
    public electronService: ElectronService,
    public sessionService: SessionService,
    private _wowUpService: WowUpService,
    private _dialogFactory: DialogFactory,
    private _translateService: TranslateService
  ) {}

  public onClickLogin(): void {
    this._wowUpService.login();

  }

  public onClickLogout(): void {
    const title = this._translateService.instant("PAGES.ACCOUNT.LOGOUT_CONFIRMATION_TITLE");
    const message = this._translateService.instant("PAGES.ACCOUNT.LOGOUT_CONFIRMATION_MESSAGE");

    const dialogRef = this._dialogFactory.getConfirmDialog(title, message);

    dialogRef
      .afterClosed()
      .pipe(
        map((result) => {
          if (result) {
            this.sessionService.clearWowUpAuthToken();
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
    this._wowUpService.openExternalLink(`${AppConfig.wowUpWebsiteUrl}/account`).catch((e) => console.error(e));
  }
}
