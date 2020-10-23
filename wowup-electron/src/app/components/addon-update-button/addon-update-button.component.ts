import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { AddonViewModel } from "app/business-objects/my-addon-list-item";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { AddonInstallState } from "app/models/wowup/addon-install-state";
import { AddonService } from "app/services/addons/addon.service";
import { AnalyticsService } from "app/services/analytics/analytics.service";
import { getEnumName } from "app/utils/enum.utils";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";

@Component({
  selector: "app-addon-update-button",
  templateUrl: "./addon-update-button.component.html",
  styleUrls: ["./addon-update-button.component.scss"],
})
export class AddonUpdateButtonComponent implements OnInit, OnDestroy {
  @Input() listItem: AddonViewModel;

  @Output() onViewUpdated: EventEmitter<boolean> = new EventEmitter();

  private _subscriptions: Subscription[] = [];

  constructor(
    private _addonService: AddonService,
    private _analyticsService: AnalyticsService,
    private _translateService: TranslateService
  ) {}

  ngOnInit(): void {
    const addonInstalledSub = this._addonService.addonInstalled$
      .pipe(filter((evt) => evt.addon.id === this.listItem.addon.id))
      .subscribe((evt) => {
        this.listItem.installState = evt.installState;
        this.listItem.installProgress = evt.progress;
        this.onViewUpdated.emit(true);
      });

    this._subscriptions.push(addonInstalledSub);
  }

  ngOnDestroy(): void {}

  public get actionLabel() {
    return `${getEnumName(WowClientType, this.listItem?.addon?.clientType)}|${
      this.listItem?.addon.providerName
    }|${this.listItem?.addon.externalId}|${this.listItem?.addon.name}`;
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
    this._analyticsService.trackUserAction(
      "addons",
      "update_addon",
      this.actionLabel
    );

    this._addonService.installAddon(
      this.listItem.addon.id
      // this.onInstallUpdate
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
