import * as _ from "lodash";
import { BehaviorSubject, Subscription } from "rxjs";
import { map } from "rxjs/operators";

import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { MatSelectChange } from "@angular/material/select";
import { MatSlideToggleChange } from "@angular/material/slide-toggle";
import { TranslateService } from "@ngx-translate/core";

import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { AddonChannelType } from "../../../common/wowup/addon-channel-type";
import { WowInstallation } from "../../models/wowup/wow-installation";
import { WarcraftInstallationService } from "../../services/warcraft/warcraft-installation.service";
import { getEnumList, getEnumName } from "../../utils/enum.utils";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";

@Component({
  selector: "app-wow-client-options",
  templateUrl: "./wow-client-options.component.html",
  styleUrls: ["./wow-client-options.component.scss"],
})
export class WowClientOptionsComponent implements OnInit, OnDestroy {
  @Input("installationId") public installationId: string;

  private readonly _editModeSrc = new BehaviorSubject(false);
  private readonly _isBusySrc = new BehaviorSubject(false);
  private installation: WowInstallation;
  private subscriptions: Subscription[] = [];

  public readonly addonChannelInfos: {
    type: AddonChannelType;
    name: string;
  }[];

  public clientTypeName: string;
  public clientFolderName: string;
  public clientLocation: string;
  public installationModel: WowInstallation;
  public selectedAddonChannelType: AddonChannelType;
  public editMode$ = this._editModeSrc.asObservable();
  public isBusy$ = this._isBusySrc.asObservable();

  public clientAutoUpdate: boolean;

  public set isBusy(enabled: boolean) {
    this._isBusySrc.next(enabled);
  }

  public set editMode(enabled: boolean) {
    this._editModeSrc.next(enabled);
  }

  public get installationLabel(): string {
    return this.installation?.label ?? "";
  }

  public set installationLabel(input: string) {
    if (this.installation) {
      this.installation.label = input;
    }
  }

  public constructor(
    private _dialog: MatDialog,
    private _translateService: TranslateService,
    private _warcraftInstallationService: WarcraftInstallationService
  ) {
    this.addonChannelInfos = this.getAddonChannelInfos();
  }

  public ngOnInit(): void {
    this.installation = this._warcraftInstallationService.getWowInstallation(this.installationId);
    if (!this.installation) {
      throw new Error(`Failed to find installation: ${this.installationId}`);
    }

    this.installationModel = { ...this.installation };
    this.selectedAddonChannelType = this.installation.defaultAddonChannelType;
    this.clientAutoUpdate = this.installation.defaultAutoUpdate;
    this.clientTypeName = `COMMON.CLIENT_TYPES.${getEnumName(
      WowClientType,
      this.installation.clientType
    ).toUpperCase()}`;
    this.clientFolderName = this.installation.label;
    this.clientLocation = this.installation.location;
  }

  public ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  public onDefaultAddonChannelChange(evt: MatSelectChange): void {
    this.installationModel.defaultAddonChannelType = evt.value;
  }

  public onDefaultAutoUpdateChange(evt: MatSlideToggleChange): void {
    this.installationModel.defaultAutoUpdate = evt.checked;
  }

  public onClickCancel(): void {
    this.installationModel = { ...this.installation };
    this.editMode = false;
  }

  public onClickSave(): void {
    this.isBusy = true;
    try {
      // const saveAutoUpdate = this.installationModel.defaultAutoUpdate !== this.installation.defaultAutoUpdate;

      this.installation = { ...this.installationModel };
      this._warcraftInstallationService.updateWowInstallation(this.installation);

      // if (saveAutoUpdate) {
      //   await this._addonService.setInstallationAutoUpdate(this.installation);
      //   this._sessionService.notifyAddonsChanged();
      // }
    } catch (e) {
      console.error(e);
    } finally {
      this.isBusy = false;
      this.editMode = false;
    }
  }

  public onClickRemove(): void {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant("PAGES.OPTIONS.WOW.CLEAR_INSTALL_LOCATION_DIALOG.TITLE"),
        message: this._translateService.instant("PAGES.OPTIONS.WOW.CLEAR_INSTALL_LOCATION_DIALOG.MESSAGE", {
          location: this._translateService.instant(this.installation.location),
        }),
      },
    });

    dialogRef
      .afterClosed()
      .pipe(
        map((result) => {
          if (!result) {
            return;
          }

          this._warcraftInstallationService.removeWowInstallation(this.installation);
        })
      )
      .subscribe();
  }

  private getAddonChannelInfos() {
    return getEnumList(AddonChannelType).map((type: AddonChannelType) => {
      const channelName = getEnumName(AddonChannelType, type).toUpperCase();
      return {
        type: type,
        name: `COMMON.ENUM.ADDON_CHANNEL_TYPE.${channelName}`,
      };
    });
  }
}
