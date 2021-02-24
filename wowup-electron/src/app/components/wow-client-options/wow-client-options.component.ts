import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { MatSelectChange } from "@angular/material/select";
import { MatSlideToggleChange } from "@angular/material/slide-toggle";
import { TranslateService } from "@ngx-translate/core";
import { WowInstallation } from "app/models/wowup/wow-installation";
import { WarcraftInstallationService } from "app/services/warcraft/warcraft-installation.service";
import * as _ from "lodash";
import * as path from "path";
import { Subscription } from "rxjs";
import { map } from "rxjs/operators";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { AddonChannelType } from "../../models/wowup/addon-channel-type";
import { ElectronService } from "../../services";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { getEnumList, getEnumName } from "../../utils/enum.utils";
import { AlertDialogComponent } from "../alert-dialog/alert-dialog.component";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";

@Component({
  selector: "app-wow-client-options",
  templateUrl: "./wow-client-options.component.html",
  styleUrls: ["./wow-client-options.component.scss"],
})
export class WowClientOptionsComponent implements OnInit, OnDestroy {
  @Input("installationId") installationId: string;

  private installation: WowInstallation;
  private installationModel: WowInstallation;
  private subscriptions: Subscription[] = [];

  public readonly addonChannelInfos: {
    type: AddonChannelType;
    name: string;
  }[];

  public clientTypeName: string;
  public clientFolderName: string;
  public clientLocation: string;
  public selectedAddonChannelType: AddonChannelType;

  public clientAutoUpdate: boolean;
  public editMode = false;

  public get installationLabel(): string {
    return this.installation?.label ?? "";
  }

  public set installationLabel(input: string) {
    if (this.installation) {
      this.installation.label = input;
    }
  }

  constructor(
    private _dialog: MatDialog,
    private _electronService: ElectronService,
    private _warcraftService: WarcraftService,
    private _wowupService: WowUpService,
    private _cdRef: ChangeDetectorRef,
    private _translateService: TranslateService,
    private _warcraftInstallationService: WarcraftInstallationService
  ) {
    this.addonChannelInfos = this.getAddonChannelInfos();

    // const warcraftProductSubscription = this._warcraftService.products$.subscribe((products) => {
    //   const product = products.find((p) => p.clientType === this.clientType);
    //   if (product) {
    //     this.clientLocation = product.location;
    //     this._cdRef.detectChanges();
    //   }
    // });

    // this.subscriptions.push(warcraftProductSubscription);
  }

  ngOnInit(): void {
    this.installation = this._warcraftInstallationService.getWowInstallation(this.installationId);
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

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  onDefaultAddonChannelChange(evt: MatSelectChange): void {
    this.installation.defaultAddonChannelType = evt.value;
    this._warcraftInstallationService.updateWowInstallation(this.installation);
  }

  onDefaultAutoUpdateChange(evt: MatSlideToggleChange): void {
    this.installation.defaultAutoUpdate = evt.checked;
    this._warcraftInstallationService.updateWowInstallation(this.installation);
  }

  onClickCancel(): void {
    this.installationModel = { ...this.installation };
    this.editMode = false;
  }

  onClickSave(): void {
    this.installation = { ...this.installationModel };
    this._warcraftInstallationService.updateWowInstallation(this.installation);
    this.editMode = false;
  }

  onClickRemove(): void {
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

  public async clearInstallPath(): Promise<void> {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant("PAGES.OPTIONS.WOW.CLEAR_INSTALL_LOCATION_DIALOG.TITLE"),
        message: this._translateService.instant("PAGES.OPTIONS.WOW.CLEAR_INSTALL_LOCATION_DIALOG.MESSAGE", {
          clientName: this._translateService.instant(this.clientTypeName),
        }),
      },
    });

    const result = await dialogRef.afterClosed().toPromise();

    if (!result) {
      return;
    }

    try {
      // await this._warcraftService.removeWowFolderPath(this.clientType).toPromise();
      this.clientLocation = "";
      this._cdRef.detectChanges();
      console.debug("Remove client location complete");
    } catch (e) {
      console.error("Failed to remove location", e);
    }
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
