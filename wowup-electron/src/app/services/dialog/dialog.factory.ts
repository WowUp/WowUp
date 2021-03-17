import { Injectable } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";

import { AddonChannelType } from "../../../common/wowup/models";
import { AddonViewModel } from "../../business-objects/addon-view-model";
import { AddonDetailComponent, AddonDetailModel } from "../../components/addon-detail/addon-detail.component";
import { AlertDialogComponent } from "../../components/alert-dialog/alert-dialog.component";
import { ConfirmDialogComponent } from "../../components/confirm-dialog/confirm-dialog.component";
import { AddonSearchResult } from "../../models/wowup/addon-search-result";

@Injectable({
  providedIn: "root",
})
export class DialogFactory {
  public constructor(private _dialog: MatDialog, private _translateService: TranslateService) {}

  public getConfirmDialog(title: string, message: string): MatDialogRef<ConfirmDialogComponent, any> {
    return this._dialog.open(ConfirmDialogComponent, {
      data: {
        title,
        message,
      },
    });
  }

  public getErrorDialog(title: string, message: string): MatDialogRef<AlertDialogComponent, any> {
    return this._dialog.open(AlertDialogComponent, {
      minWidth: 250,
      data: {
        title,
        message,
      },
    });
  }

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

  public getAddonDetailsDialog(listItem: AddonViewModel): MatDialogRef<AddonDetailComponent, any> {
    // If this addon is in warning state, we wont be able to get details
    if (listItem.addon.warningType !== undefined) {
      return;
    }

    const data: AddonDetailModel = {
      listItem: listItem.clone(),
    };

    return this._dialog.open(AddonDetailComponent, {
      data,
    });
  }
}
