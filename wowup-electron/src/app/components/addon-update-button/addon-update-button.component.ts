import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { AddonViewModel } from "app/business-objects/my-addon-list-item";
import { AddonInstallState } from "app/models/wowup/addon-install-state";
import { AddonService } from "app/services/addons/addon.service";
import { filter } from "rxjs/operators";

@Component({
  selector: "app-addon-update-button",
  templateUrl: "./addon-update-button.component.html",
  styleUrls: ["./addon-update-button.component.scss"],
})
export class AddonUpdateButtonComponent implements OnInit, OnDestroy {
  @Input() listItem: AddonViewModel;

  constructor(
    private _addonService: AddonService,
    private _translateService: TranslateService
  ) {}

  ngOnInit(): void {
   
  }
    
  ngOnDestroy(): void {
  }

  public get installProgress() {
    return this.listItem?.installProgress || 0;
  }

  public get isButtonActive() {
    return (
      this.listItem?.installState !== AddonInstallState.Unknown &&
      this.listItem?.installState !== AddonInstallState.Complete
    );
  }

  public get isButtonDisabled() {
    return (
      this.listItem?.isUpToDate ||
      this.listItem?.installState < AddonInstallState.Unknown 
    );
  }

  public get buttonText() {
    if (this.listItem?.installState !== AddonInstallState.Unknown) {
      return this.getInstallStateText(this.listItem?.installState);
    }

    return this.getStatusText();
  }

  public onInstallUpdateClick() {
    this._addonService.installAddon(
      this.listItem.addon.id,
      this.onInstallUpdate
    );
  }

  private onInstallUpdate = (
    installState: AddonInstallState,
    progress: number
  ) => {
    this.listItem.installState = installState;
    this.listItem.installProgress = progress;
  };

  public getStatusText() {
    if (this.listItem?.needsInstall) {
      return this._translateService.instant(
        "PAGES.MY_ADDONS.TABLE.ADDON_INSTALL_BUTTON"
      );
    }

    if (this.listItem?.needsUpdate) {
      return this._translateService.instant(
        "PAGES.MY_ADDONS.TABLE.ADDON_UPDATE_BUTTON"
      );
    }

    return this.listItem?.statusText;
  }

  private getInstallStateText(installState: AddonInstallState) {
    switch (installState) {
      case AddonInstallState.BackingUp:
        return this._translateService.instant("COMMON.ADDON_STATUS.BACKINGUP");
      case AddonInstallState.Complete:
        return this._translateService.instant("COMMON.ADDON_STATE.UPTODATE");
      case AddonInstallState.Downloading:
        return this._translateService.instant(
          "COMMON.ADDON_STATUS.DOWNLOADING"
        );
      case AddonInstallState.Installing:
        return this._translateService.instant("COMMON.ADDON_STATUS.INSTALLING");
      case AddonInstallState.Pending:
        return this._translateService.instant("COMMON.ADDON_STATUS.PENDING");
      default:
        return "";
    }
  }
}
