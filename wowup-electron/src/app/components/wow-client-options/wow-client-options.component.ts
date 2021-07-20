import { BehaviorSubject, Subscription } from "rxjs";
import { filter, map } from "rxjs/operators";

import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { MatSelectChange } from "@angular/material/select";
import { MatSlideToggleChange } from "@angular/material/slide-toggle";
import { TranslateService } from "@ngx-translate/core";

import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { AddonChannelType } from "../../../common/wowup/models";
import { WowInstallation } from "../../models/wowup/wow-installation";
import { WarcraftInstallationService } from "../../services/warcraft/warcraft-installation.service";
import { getEnumList, getEnumName } from "../../utils/enum.utils";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { SessionService } from "../../services/session/session.service";

@Component({
  selector: "app-wow-client-options",
  templateUrl: "./wow-client-options.component.html",
  styleUrls: ["./wow-client-options.component.scss"],
})
export class WowClientOptionsComponent implements OnInit, OnDestroy {
  @Input("installationId") public installationId = "";
  @Input("index") public installationIndex!: number;

  private readonly _editModeSrc = new BehaviorSubject(false);
  private readonly _isBusySrc = new BehaviorSubject(false);
  private installation: WowInstallation | undefined;
  private subscriptions: Subscription[] = [];

  public readonly addonChannelInfos: {
    type: AddonChannelType;
    name: string;
  }[];

  public clientTypeName = "";
  public clientFolderName = "";
  public clientLocation = "";
  public installationModel!: WowInstallation;
  public selectedAddonChannelType: AddonChannelType = AddonChannelType.Stable;
  public editMode$ = this._editModeSrc.asObservable();
  public isBusy$ = this._isBusySrc.asObservable();
  public installationCount$ = this._warcraftInstallationService.wowInstallations$.pipe(
    map((installations) => installations.length)
  );

  public clientAutoUpdate = false;

  public set isBusy(enabled: boolean) {
    this._isBusySrc.next(enabled);
  }

  public get installationLabel(): string {
    return this.installation?.label ?? "";
  }

  public set installationLabel(input: string) {
    if (this.installation) {
      this.installation.label = input;
    }
  }

  public get executableName(): string {
    if (!this.installation) {
      return "";
    }

    return this._warcraftService.getExecutableName(this.installation.clientType);
  }

  public get wowLogoImage(): string {
    if (!this.installation) {
      return "";
    }

    switch (this.installation.clientType) {
      case WowClientType.Beta:
      case WowClientType.ClassicBeta:
      case WowClientType.ClassicPtr:
      case WowClientType.Classic:
        return "assets/images/wow-classic-tbc-logo.png";
      case WowClientType.ClassicEra:
        return "assets/images/wow-classic-logo.png";
      case WowClientType.Retail:
      case WowClientType.RetailPtr:
        return "assets/images/wow-retail-logo.png";
      default:
        return "";
    }
  }

  public constructor(
    private _dialog: MatDialog,
    private _translateService: TranslateService,
    private _warcraftInstallationService: WarcraftInstallationService,
    private _warcraftService: WarcraftService,
    private _sessionService: SessionService
  ) {
    this.addonChannelInfos = this.getAddonChannelInfos();

    const editingSub = this._sessionService.editingWowInstallationId$
      .pipe(filter((installationId) => this.installationId !== installationId))
      .subscribe(() => {
        this.onClickCancel();
      });

    this.subscriptions.push(editingSub);
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
    if (!this.installationModel) {
      return;
    }
    this.installationModel.defaultAddonChannelType = evt.value;
  }

  public onDefaultAutoUpdateChange(evt: MatSlideToggleChange): void {
    if (!this.installationModel) {
      return;
    }

    this.installationModel.defaultAutoUpdate = evt.checked;
  }

  public onDefaultTrackAddonsChange(evt: MatSlideToggleChange): void {
    if (!this.installationModel) {
      return;
    }

    this.installationModel.defaultTrackAddons = evt.checked;
  }

  public onClickMoveUp(): void {
    this._warcraftInstallationService.reOrderInstallation(this.installationId, -1);
  }

  public onClickMoveDown(): void {
    this._warcraftInstallationService.reOrderInstallation(this.installationId, 1);
  }

  public onClickEdit(): void {
    this._editModeSrc.next(true);
    this._sessionService.editingWowInstallationId$.next(this.installationId);
  }

  public onClickCancel(): void {
    if (this.installation) {
      this.installationModel = { ...this.installation };
    }

    this._editModeSrc.next(false);
  }

  public onClickSave(): void {
    if (!this.installationModel) {
      return;
    }

    this.isBusy = true;
    try {
      // const saveAutoUpdate = this.installationModel.defaultAutoUpdate !== this.installation.defaultAutoUpdate;

      this.installation = { ...this.installationModel };
      if (this.installation) {
        this._warcraftInstallationService.updateWowInstallation(this.installation);
      }

      // if (saveAutoUpdate) {
      //   await this._addonService.setInstallationAutoUpdate(this.installation);
      //   this._sessionService.notifyAddonsChanged();
      // }
    } catch (e) {
      console.error(e);
    } finally {
      this.isBusy = false;
      this._editModeSrc.next(false);
    }
  }

  public onClickRemove(): void {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant("PAGES.OPTIONS.WOW.CLEAR_INSTALL_LOCATION_DIALOG.TITLE"),
        message: this._translateService.instant("PAGES.OPTIONS.WOW.CLEAR_INSTALL_LOCATION_DIALOG.MESSAGE", {
          location: this._translateService.instant(this.installation?.location ?? ""),
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

          if (this.installation) {
            this._warcraftInstallationService.removeWowInstallation(this.installation);
          }
        })
      )
      .subscribe();
  }

  private getAddonChannelInfos(): { type: AddonChannelType; name: string }[] {
    return getEnumList(AddonChannelType).map((type: any) => {
      const channelName = getEnumName(AddonChannelType, type).toUpperCase();
      return {
        type: type,
        name: `COMMON.ENUM.ADDON_CHANNEL_TYPE.${channelName}`,
      };
    });
  }
}
