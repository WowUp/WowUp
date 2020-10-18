import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { GetAddonListItem } from "app/business-objects/get-addon-list-item";
import { AddonInstallState } from "app/models/wowup/addon-install-state";
import { AddonService } from "app/services/addons/addon.service";
import { SessionService } from "app/services/session/session.service";
import { MatProgressButtonOptions } from "mat-progress-buttons";
import { BehaviorSubject, Observable, Subject } from "rxjs";

@Component({
  selector: "app-get-addon-status-column",
  templateUrl: "./get-addon-status-column.component.html",
  styleUrls: ["./get-addon-status-column.component.scss"],
})
export class GetAddonStatusColumnComponent implements OnInit, OnDestroy {
  @Input() listItem: GetAddonListItem;

  private readonly _buttonOptionsSrc: BehaviorSubject<MatProgressButtonOptions>;
  private installState: AddonInstallState = AddonInstallState.Unknown;
  private installProgress: number = 0;

  public readonly buttonOptions$: Observable<MatProgressButtonOptions>;

  public get buttonText() {
    if (this.installState !== AddonInstallState.Unknown) {
      return this.getInstallStateText(this.installState);
    }

    return this._translate.instant("COMMON.ADDON_STATE.INSTALL");
  }

  public getInstallStateText(installState: AddonInstallState) {
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

  public get isButtonActive() {
    return (
      this.installState !== AddonInstallState.Unknown &&
      this.installState !== AddonInstallState.Complete
    );
  }

  public get isButtonDisabled() {
    return this.installState === AddonInstallState.Complete;
  }

  public getButtonOptions(): MatProgressButtonOptions {
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

  constructor(
    private _addonService: AddonService,
    private _sessionService: SessionService,
    private _translate: TranslateService
  ) {
    this._buttonOptionsSrc = new BehaviorSubject<MatProgressButtonOptions>(
      this.getButtonOptions()
    );
    this.buttonOptions$ = this._buttonOptionsSrc.asObservable();
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this._buttonOptionsSrc.complete();
  }

  onInstallUpdateClick() {
    this._addonService.installPotentialAddon(
      this.listItem.searchResult,
      this._sessionService.selectedClientType,
      this.onInstallUpdate
    );
  }

  private onInstallUpdate = (
    installState: AddonInstallState,
    progress: number
  ) => {
    this.installState = installState;
    this.installProgress = progress;
    this._buttonOptionsSrc.next(this.getButtonOptions());
  };
}
