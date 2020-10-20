import { Component, Input } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { AddonInstallState } from "app/models/wowup/addon-install-state";
import { AddonSearchResult } from "app/models/wowup/addon-search-result";
import { AddonService } from "app/services/addons/addon.service";
import { SessionService } from "app/services/session/session.service";

@Component({
  selector: "app-addon-install-button",
  templateUrl: "./addon-install-button.component.html",
  styleUrls: ["./addon-install-button.component.scss"],
})
export class AddonInstallButtonComponent {
  @Input() addonSearchResult: AddonSearchResult;

  public disableButton = false;
  public showProgress = false;
  public progressValue = 0;
  public buttonText = this.getButtonText(AddonInstallState.Unknown);

  constructor(
    private _addonService: AddonService,
    private _sessionService: SessionService,
    private _translate: TranslateService
  ) {}

  public getIsButtonActive(installState: AddonInstallState) {
    return (
      installState !== AddonInstallState.Unknown &&
      installState !== AddonInstallState.Complete
    );
  }

  public getIsButtonDisabled(installState: AddonInstallState) {
    return installState !== AddonInstallState.Unknown;
  }

  public getInstallStateText(installState: AddonInstallState) {
    console.log("getInstallStateText", installState);
    switch (installState) {
      case AddonInstallState.BackingUp:
        return this._translate.instant("COMMON.ADDON_STATUS.BACKINGUP");
      case AddonInstallState.Complete:
        return this._translate.instant("COMMON.ADDON_STATUS.COMPLETE");
      case AddonInstallState.Downloading:
        return this._translate.instant("COMMON.ADDON_STATUS.DOWNLOADING");
      case AddonInstallState.Installing:
        return this._translate.instant("COMMON.ADDON_STATUS.INSTALLING");
      case AddonInstallState.Pending:
        return this._translate.instant("COMMON.ADDON_STATUS.PENDING");
      default:
        return "";
    }
  }

  public getButtonText(installState: AddonInstallState) {
    if (installState !== AddonInstallState.Unknown) {
      return this.getInstallStateText(installState);
    }

    return this._translate.instant("COMMON.ADDON_STATE.INSTALL");
  }

  public onInstallUpdateClick() {
    this._addonService.installPotentialAddon(
      this.addonSearchResult,
      this._sessionService.selectedClientType,
      this.onInstallUpdate
    );
  }

  private onInstallUpdate = (
    installState: AddonInstallState,
    progress: number
  ) => {
    this.showProgress = this.getIsButtonActive(installState);
    this.disableButton = this.getIsButtonDisabled(installState);
    this.progressValue = progress;
    this.buttonText = this.getButtonText(installState);
  };
}
