import { AgRendererComponent } from "ag-grid-angular";
import { ICellRendererParams } from "ag-grid-community";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";

import { Component, NgZone, OnDestroy } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";

import { Addon } from "../../../common/entities/addon";
import { AddonWarningType } from "../../../common/wowup/models";
import { AddonViewModel } from "../../business-objects/addon-view-model";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { AddonService } from "../../services/addons/addon.service";
import * as AddonUtils from "../../utils/addon.utils";
import { AlertDialogComponent } from "../alert-dialog/alert-dialog.component";

@Component({
  selector: "app-my-addon-status-column",
  templateUrl: "./my-addon-status-column.component.html",
  styleUrls: ["./my-addon-status-column.component.scss"],
})
export class MyAddonStatusColumnComponent implements AgRendererComponent, OnDestroy {
  private _subscriptions: Subscription[] = [];

  public listItem!: AddonViewModel;
  public warningType?: AddonWarningType;
  public hasWarning = false;
  public showStatusText = false;
  public statusText = "";
  public isIgnored = false;
  public installState?: AddonInstallState;
  public installProgress?: number;

  public constructor(
    private _dialog: MatDialog,
    private _addonService: AddonService,
    private _translateService: TranslateService,
    private _ngZone: NgZone
  ) {
    const addonInstalledSub = this._addonService.addonInstalled$
      .pipe(
        filter(
          (evt) =>
            evt.addon.externalId === this.listItem.addon?.externalId &&
            evt.addon.providerName === this.listItem.addon?.providerName
        )
      )
      .subscribe((evt) => {
        this._ngZone.run(() => {
          this.installState = evt.installState;
          this.installProgress = evt.progress;

          if (evt.installState !== AddonInstallState.Complete) {
            this.showStatusText = false;
          } else {
            this.showStatusText = !AddonUtils.needsUpdate(evt.addon) || (this.listItem?.addon?.isIgnored ?? true);
          }
          this.statusText = this.getStatusText(evt.addon);
        });
      });

    this._subscriptions.push(addonInstalledSub);
  }

  public agInit(params: ICellRendererParams): void {
    this.listItem = params.data;

    this.warningType = this.listItem?.addon?.warningType;
    this.hasWarning = this.warningType !== undefined;
    this.showStatusText = this.listItem?.isUpToDate() || (this.listItem?.addon?.isIgnored ?? true);
    this.statusText = this.getStatusText(this.listItem?.addon);
    this.isIgnored = this.listItem.addon?.isIgnored ?? true;
  }

  public ngOnDestroy(): void {
    this._subscriptions.forEach((sub) => sub.unsubscribe());
  }

  public refresh(): boolean {
    return false;
  }

  public afterGuiAttached?(): void {}

  public getStatusText(addon: Addon | undefined, installState = AddonInstallState.Unknown): string {
    if (!addon) {
      return "";
    }

    if (addon.isIgnored) {
      return "COMMON.ADDON_STATE.IGNORED";
    }

    if (installState === AddonInstallState.Pending) {
      return "COMMON.ADDON_STATE.PENDING";
    }

    if (!AddonUtils.needsUpdate(addon)) {
      return "COMMON.ADDON_STATE.UPTODATE";
    }

    return this.listItem.stateTextTranslationKey;
  }

  public getWarningDescriptionKey(): string {
    if (!this.warningType) {
      return "";
    }

    switch (this.warningType) {
      case AddonWarningType.MissingOnProvider:
        return "COMMON.ADDON_WARNING.MISSING_ON_PROVIDER_DESCRIPTION";
      case AddonWarningType.NoProviderFiles:
        return "COMMON.ADDON_WARNING.NO_PROVIDER_FILES_DESCRIPTION";
      default:
        return "COMMON.ADDON_WARNING.GENERIC_DESCRIPTION";
    }
  }

  public onWarningButton(): void {
    const descriptionKey = this.getWarningDescriptionKey();
    this._dialog.open(AlertDialogComponent, {
      data: {
        title: this._translateService.instant("COMMON.ADDON_STATE.WARNING"),
        message: this._translateService.instant(descriptionKey, {
          providerName: this.listItem.providerName,
        }),
      },
    });
  }
}
