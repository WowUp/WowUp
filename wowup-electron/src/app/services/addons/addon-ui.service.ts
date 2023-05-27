import { Injectable } from "@angular/core";
import { MatLegacyDialog as MatDialog, MatLegacyDialogRef as MatDialogRef } from "@angular/material/legacy-dialog";
import { TranslateService } from "@ngx-translate/core";
import { from, Observable, of } from "rxjs";
import { first, map, switchMap } from "rxjs/operators";
import { Addon } from "wowup-lib-core";
import { ConfirmDialogComponent } from "../../components/common/confirm-dialog/confirm-dialog.component";
import { SnackbarService } from "../snackbar/snackbar.service";
import { AddonService } from "./addon.service";

export interface RemoveAddonResult {
  dependenciesRemoved: boolean;
  removed: boolean;
}

@Injectable({
  providedIn: "root",
})
export class AddonUiService {
  public constructor(
    private _addonService: AddonService,
    private _snackbarService: SnackbarService,
    private _translateService: TranslateService,
    private _dialog: MatDialog
  ) {}

  public handleRemoveAddon(addon: Addon): Observable<RemoveAddonResult> {
    return this.getRemoveAddonPrompt(addon.name)
      .afterClosed()
      .pipe(
        first(),
        switchMap((result) => {
          if (!result) {
            return of({ dependenciesRemoved: false, removed: false });
          }

          if (this._addonService.getRequiredDependencies(addon).length === 0) {
            return from(this._addonService.removeAddon(addon)).pipe(
              map(() => {
                this._snackbarService.showSuccessSnackbar("PAGES.MY_ADDONS.ADDON_REMOVED_SNACKBAR", {
                  localeArgs: {
                    addonName: addon.name,
                  },
                });
                return { dependenciesRemoved: false, removed: true };
              })
            );
          } else {
            return this.getRemoveDependenciesPrompt(addon.name, (addon.dependencies ?? []).length)
              .afterClosed()
              .pipe(
                switchMap((result: boolean) => from(this._addonService.removeAddon(addon, result))),
                map(() => {
                  this._snackbarService.showSuccessSnackbar("PAGES.MY_ADDONS.ADDON_REMOVED_SNACKBAR", {
                    localeArgs: {
                      addonName: addon.name,
                    },
                  });
                  return { dependenciesRemoved: true, removed: true };
                })
              );
          }
        })
      );
  }

  private getRemoveAddonPrompt(addonName: string): MatDialogRef<ConfirmDialogComponent, any> {
    const title: string = this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.TITLE", { count: 1 });
    const message1: string = this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ONE", {
      addonName,
    });
    const message2: string = this._translateService.instant(
      "PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ACTION_EXPLANATION"
    );
    const message = `${message1}\n\n${message2}`;

    return this._dialog.open(ConfirmDialogComponent, {
      data: {
        title,
        message,
      },
    });
  }

  private getRemoveDependenciesPrompt(
    addonName: string,
    dependencyCount: number
  ): MatDialogRef<ConfirmDialogComponent, any> {
    const title = this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.DEPENDENCY_TITLE");
    const message1: string = this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.DEPENDENCY_MESSAGE", {
      addonName,
      dependencyCount,
    });
    const message2: string = this._translateService.instant(
      "PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ACTION_EXPLANATION"
    );
    const message = `${message1}\n\n${message2}`;

    return this._dialog.open(ConfirmDialogComponent, {
      data: {
        title,
        message,
      },
    });
  }
}
