import { Directive, HostListener } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";
import { from, of } from "rxjs";
import { catchError, first, switchMap } from "rxjs/operators";
import { ConfirmDialogComponent } from "../components/confirm-dialog/confirm-dialog.component";
import { WowUpService } from "../services/wowup/wowup.service";

@Directive({
  selector: "[appExternalLink]",
})
export class ExternalLinkDirective {
  @HostListener("click", ["$event"]) public onClick($event: MouseEvent): void {
    $event.preventDefault();
    $event.stopPropagation();

    const target = ($event as any).path?.find((t) => t.tagName === "A");
    this.confirmLinkNavigation(target.href);
  }

  public constructor(
    private _wowupService: WowUpService,
    private _dialog: MatDialog,
    private _translateService: TranslateService
  ) {}

  private confirmLinkNavigation(href: string) {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant("APP.LINK_NAVIGATION.TITLE"),
        message: this._translateService.instant("APP.LINK_NAVIGATION.MESSAGE", { url: href }),
      },
    });

    dialogRef
      .afterClosed()
      .pipe(
        first(),
        switchMap((result) => {
          if (!result) {
            return of(undefined);
          }

          return from(this._wowupService.openExternalLink(href));
        }),
        catchError((e) => {
          console.error("failed to open external link", e);
          return of(undefined);
        })
      )
      .subscribe();
  }
}
