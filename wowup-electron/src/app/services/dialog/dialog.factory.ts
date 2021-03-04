import { Injectable } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";

import { AddonChannelType } from "../../../common/wowup/models";
import { AddonDetailComponent, AddonDetailModel } from "../../components/addon-detail/addon-detail.component";
import { ConfirmDialogComponent } from "../../components/confirm-dialog/confirm-dialog.component";
import { AddonSearchResult } from "../../models/wowup/addon-search-result";

@Injectable({
  providedIn: "root",
})
export class DialogFactory {
  public constructor(private _dialog: MatDialog, private _translateService: TranslateService) {}

  public getPotentialAddonDetailsDialog(
    searchResult: AddonSearchResult,
    channelType: AddonChannelType
  ): MatDialogRef<AddonDetailComponent, any> {
    const data: AddonDetailModel = {
      searchResult,
      channelType,
    };

    return this._dialog.open(AddonDetailComponent, {
      data,
    });
  }

  public getRemoveAddonPrompt(addonName: string): MatDialogRef<ConfirmDialogComponent, any> {
    const title = this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.TITLE", { count: 1 });
    const message1: string = this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ONE", {
      addonName,
    });
    const message2: string = this._translateService.instant(
      "PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ACTION_EXPLANATION"
    );

    return this._dialog.open(ConfirmDialogComponent, {
      data: {
        title,
        message: `${message1}\n\n${message2}`,
      },
    });
  }

  public getRemoveDependenciesPrompt(
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

    return this._dialog.open(ConfirmDialogComponent, {
      data: {
        title,
        message: `${message1}\n\n${message2}`,
      },
    });
  }
}
