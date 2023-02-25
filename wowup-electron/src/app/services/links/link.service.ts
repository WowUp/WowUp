import { from, Observable, of } from "rxjs";
import { catchError, first, map, switchMap } from "rxjs/operators";

import { Injectable } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";

import {
  DialogResult,
  ExternalUrlConfirmationDialogComponent,
} from "../../components/common/external-url-confirmation-dialog/external-url-confirmation-dialog.component";
import { WowUpService } from "../wowup/wowup.service";
import { USER_ACTION_OPEN_LINK } from "../../../common/constants";
import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class LinkService {
  public constructor(
    private _dialog: MatDialog,
    private _electronService: ElectronService,
    private _wowUpService: WowUpService,
    private _translateService: TranslateService
  ) {}

  public async openExternalLink(url: string): Promise<void> {
    await this._electronService.openExternal(url);
  }

  public confirmLinkNavigation(href: string): Observable<any> {
    return from(this._wowUpService.getTrustedDomains()).pipe(
      first(),
      switchMap((domains) =>
        from(this._wowUpService.isTrustedDomain(href, domains)).pipe(map((isTrusted) => ({ isTrusted, domains })))
      ),
      switchMap(({ isTrusted, domains }) => {
        if (isTrusted) {
          return from(this.openExternalLink(href));
        } else {
          return this.showLinkNavigationDialog(href, domains);
        }
      }),
      catchError((e) => {
        console.error(e);
        return of(undefined);
      })
    );
  }

  private showLinkNavigationDialog(href: string, domains: string[]): Observable<any> {
    const dialogRef = this._dialog.open(ExternalUrlConfirmationDialogComponent, {
      data: {
        title: this._translateService.instant("APP.LINK_NAVIGATION.TITLE"),
        message: this._translateService.instant("APP.LINK_NAVIGATION.MESSAGE", { url: href }),
        url: href,
        domains,
      },
    });

    return dialogRef.afterClosed().pipe(
      first(),
      switchMap((result: DialogResult) => {
        if (!result.success) {
          return of(undefined);
        }

        if (result.trustDomain !== "") {
          return from(this._wowUpService.trustDomain(result.trustDomain)).pipe(
            switchMap(() => from(this.openExternalLink(href)))
          );
        } else {
          return from(this.openExternalLink(href));
        }
      }),
      catchError((e) => {
        console.error("failed to open external link", e);
        return of(undefined);
      })
    );
  }
}
