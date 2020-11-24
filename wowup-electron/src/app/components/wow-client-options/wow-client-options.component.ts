import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { MatSelectChange } from "@angular/material/select";
import { MatSlideToggleChange } from "@angular/material/slide-toggle";
import { TranslateService } from "@ngx-translate/core";
import * as _ from "lodash";
import { map } from "lodash";
import * as path from "path";
import { from, Subscription } from "rxjs";
import { switchMap } from "rxjs/operators";
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
  @Input("clientType") clientType: WowClientType;

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

  constructor(
    private _dialog: MatDialog,
    private _electronService: ElectronService,
    private _warcraftService: WarcraftService,
    private _wowupService: WowUpService,
    private _cdRef: ChangeDetectorRef,
    private _translateService: TranslateService
  ) {
    this.addonChannelInfos = this.getAddonChannelInfos();

    const warcraftProductSubscription = this._warcraftService.products$.subscribe((products) => {
      const product = products.find((p) => p.clientType === this.clientType);
      if (product) {
        this.clientLocation = product.location;
        this._cdRef.detectChanges();
      }
    });

    this.subscriptions.push(warcraftProductSubscription);
  }

  ngOnInit(): void {
    this.selectedAddonChannelType = this._wowupService.getDefaultAddonChannel(this.clientType);
    this.clientAutoUpdate = this._wowupService.getDefaultAutoUpdate(this.clientType);
    this.clientTypeName = `COMMON.CLIENT_TYPES.${getEnumName(WowClientType, this.clientType).toUpperCase()}`;
    this.clientFolderName = this._warcraftService.getClientFolderName(this.clientType);
    this.clientLocation = this._warcraftService.getClientLocation(this.clientType);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  onDefaultAddonChannelChange(evt: MatSelectChange) {
    this._wowupService.setDefaultAddonChannel(this.clientType, evt.value);
  }

  onDefaultAutoUpdateChange(evt: MatSlideToggleChange) {
    this._wowupService.setDefaultAutoUpdate(this.clientType, evt.checked);
  }

  public async clearInstallPath() {
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
      await this._warcraftService.removeWowFolderPath(this.clientType).toPromise();
      this.clientLocation = "";
      this._cdRef.detectChanges();
      console.debug("Remove client location complete");
    } catch (e) {
      console.error("Failed to remove location", e);
    }
  }

  async onSelectClientPath() {
    const selectedPath = await this.selectWowClientPath(this.clientType);
    if (selectedPath) {
      this.clientLocation = selectedPath;
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

  private async selectWowClientPath(clientType: WowClientType): Promise<string> {
    const dialogResult = await this._electronService.remote.dialog.showOpenDialog({
      properties: ["openDirectory"],
    });

    if (dialogResult.canceled) {
      return "";
    }

    const selectedPath = _.first(dialogResult.filePaths);
    if (!selectedPath) {
      console.warn("No path selected");
      return "";
    }

    console.log("dialogResult", selectedPath);

    const clientRelativePath = this._warcraftService.getClientRelativePath(clientType, selectedPath);

    if (this._warcraftService.setWowFolderPath(clientType, clientRelativePath)) {
      return clientRelativePath;
    }

    const clientFolderName = this._warcraftService.getClientFolderName(clientType);
    const clientExecutableName = this._warcraftService.getExecutableName(clientType);
    const clientExecutablePath = path.join(clientRelativePath, clientFolderName, clientExecutableName);
    const dialogRef = this._dialog.open(AlertDialogComponent, {
      data: {
        title: `Alert`,
        message: `Unable to set "${clientRelativePath}" as your ${getEnumName(
          WowClientType,
          clientType
        )} folder.\nPath not found: "${clientExecutablePath}".`,
      },
    });

    await dialogRef.afterClosed().toPromise();

    return "";
  }
}
