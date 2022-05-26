import { ComponentType } from "@angular/cdk/portal";
import { Injectable } from "@angular/core";
import { MatDialog, MatDialogConfig, MatDialogRef } from "@angular/material/dialog";

import { AddonChannelType } from "../../../common/wowup/models";
import { AddonViewModel } from "../../business-objects/addon-view-model";
import { AddonDetailComponent, AddonDetailModel } from "../../components/addons/addon-detail/addon-detail.component";
import { AlertDialogComponent, AlertDialogData } from "../../components/common/alert-dialog/alert-dialog.component";
import { ConfirmDialogComponent } from "../../components/common/confirm-dialog/confirm-dialog.component";
import { AddonSearchResult } from "../../models/wowup/addon-search-result";

@Injectable({
  providedIn: "root",
})
export class DialogFactory {
  public constructor(private _dialog: MatDialog) {}

  public getConfirmDialog(title: string, message: string): MatDialogRef<ConfirmDialogComponent, any> {
    return this._dialog.open(ConfirmDialogComponent, {
      data: {
        title,
        message,
      },
    });
  }

  public getAlertDialog(data: AlertDialogData): MatDialogRef<AlertDialogComponent, any> {
    return this._dialog.open(AlertDialogComponent, {
      minWidth: 250,
      data: { ...data },
    });
  }

  public getErrorDialog(title: string, message: string): MatDialogRef<AlertDialogComponent, any> {
    return this.getAlertDialog({
      title,
      message,
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

  public getAddonDetailsDialog(listItem: AddonViewModel): MatDialogRef<AddonDetailComponent, any> | undefined {
    const data: AddonDetailModel = {
      listItem: listItem.clone(),
    };

    return this._dialog.open(AddonDetailComponent, {
      data,
    });
  }

  public getDialog<T, K>(component: ComponentType<T>, config?: MatDialogConfig<K>): MatDialogRef<T, any> {
    return this._dialog.open(component, config);
  }
}
