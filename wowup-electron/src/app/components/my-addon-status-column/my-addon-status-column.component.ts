import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { MatProgressButtonOptions } from "mat-progress-buttons";
import { BehaviorSubject, Observable } from "rxjs";
import { AddonInstallState } from "app/models/wowup/addon-install-state";
import { AddonViewModel } from "app/business-objects/my-addon-list-item";
import { AddonService } from "app/services/addons/addon.service";
import { TranslateService } from "@ngx-translate/core";

@Component({
  selector: "app-my-addon-status-column",
  templateUrl: "./my-addon-status-column.component.html",
  styleUrls: ["./my-addon-status-column.component.scss"],
})
export class MyAddonStatusColumnComponent implements OnInit, OnDestroy {
  @Input() listItem: AddonViewModel;

  private readonly _buttonOptionsSrc: BehaviorSubject<MatProgressButtonOptions>;

  public readonly buttonOptions$: Observable<MatProgressButtonOptions>;

  public get showStatusText() {
    return this.listItem?.isUpToDate || this.listItem?.isIgnored;
  }

  public get installProgress() {
    return this.listItem?.installProgress || 0;
  }

  public get installState() {
    return this.listItem?.installState || AddonInstallState.Unknown;
  }

  public get buttonText() {
    if (this.installState !== AddonInstallState.Unknown) {
      return this.getInstallStateText(this.installState);
    }

    return this.getStatusText();
  }

  public get isButtonActive() {
    return (
      this.installState !== AddonInstallState.Unknown &&
      this.installState !== AddonInstallState.Complete
    );
  }

  public get isButtonDisabled() {
    return (
      this.listItem?.isUpToDate ||
      this.installState === AddonInstallState.Complete
    );
  }

  constructor(
    private _addonService: AddonService,
    private _translate: TranslateService
  ) {
    this._buttonOptionsSrc = new BehaviorSubject<MatProgressButtonOptions>(
      this.getButtonOptions()
    );
    this.buttonOptions$ = this._buttonOptionsSrc.asObservable();
  }

  ngOnInit(): void {
    this._buttonOptionsSrc.next(this.getButtonOptions());
  }

  ngOnDestroy(): void {
    this._buttonOptionsSrc.complete();
  }

  public getStatusText() {
    if (this.listItem?.needsInstall) {
      return this._translate.instant(
        "PAGES.MY_ADDONS.TABLE.ADDON_INSTALL_BUTTON"
      );
    }

    if (this.listItem?.needsUpdate) {
      return this._translate.instant(
        "PAGES.MY_ADDONS.TABLE.ADDON_UPDATE_BUTTON"
      );
    }

    if (this.listItem?.isUpToDate) {
      return this._translate.instant("COMMON.ADDON_STATE.UPTODATE");
    }

    return this.listItem?.statusText;
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
    this.installProgress = progress;

    console.log(this.getButtonOptions());
    this._buttonOptionsSrc.next(this.getButtonOptions());
  };

  private getInstallStateText(installState: AddonInstallState) {
    switch (installState) {
      case AddonInstallState.BackingUp:
        return this._translate.instant("COMMON.ADDON_STATUS.BACKINGUP");
      case AddonInstallState.Complete:
        return this._translate.instant("COMMON.ADDON_STATE.UPTODATE");
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

  private getButtonOptions(): MatProgressButtonOptions {
    return {
      active: this.isButtonActive,
      disabled: this.isButtonDisabled,
      value: this.installProgress,
      text: this.buttonText,
      mode: "determinate",
      buttonColor: "primary",
      barColor: "accent",
      customClass: "install-button",
      raised: false,
      flat: true,
      stroked: false,
      fullWidth: false,
    };
  }
}
