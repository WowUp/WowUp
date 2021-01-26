import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import { AddonViewModel } from "../../business-objects/addon-view-model";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { AddonService } from "../../services/addons/addon.service";
import { AnalyticsService } from "../../services/analytics/analytics.service";
import { getEnumName } from "../../utils/enum.utils";

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

  ngOnDestroy(): void {
    this._subscriptions.forEach((sub) => sub.unsubscribe());
    this._subscriptions = [];
  }

  public getActionLabel(): string {
    return `${getEnumName(WowClientType, this.listItem?.addon?.clientType)}|${this.listItem?.addon.providerName}|${
      this.listItem?.addon.externalId
    }|${this.listItem?.addon.name}`;
  }

  public getInstallProgress(): number {
    return this.listItem?.installProgress || 0;
  }

  public getIsButtonActive(): boolean {
    return (
      this.listItem?.installState !== AddonInstallState.Unknown &&
      this.listItem?.installState !== AddonInstallState.Complete &&
      this.listItem?.installState !== AddonInstallState.Error
    );
  }

  public getIsButtonDisabled(): boolean {
    return this.listItem?.isUpToDate() || this.listItem?.installState < AddonInstallState.Unknown;
  }

  public getButtonText(): string {
    if (this.listItem?.installState !== AddonInstallState.Unknown) {
      return this.getInstallStateText(this.listItem?.installState);
    }

    return this.getStatusText();
  }

  public async onInstallUpdateClick(): Promise<void> {
    try {
      if (this.listItem.needsUpdate()) {
        await this._addonService.updateAddon(this.listItem.addon.id);
      } else {
        await this._addonService.installAddon(this.listItem.addon.id);
      }
    } catch (e) {
      console.error(e);
    }
  }

  public getStatusText(): string {
    if (this.listItem?.needsInstall()) {
      return this._translateService.instant("PAGES.MY_ADDONS.TABLE.ADDON_INSTALL_BUTTON");
    }

    if (this.listItem?.needsUpdate()) {
      return this._translateService.instant("PAGES.MY_ADDONS.TABLE.ADDON_UPDATE_BUTTON");
    }

    if (!this.listItem) {
      return "";
    }

    return this._translateService.instant(this.listItem.stateTextTranslationKey);
  }

  private getInstallStateText(installState: AddonInstallState) {
    switch (installState) {
      case AddonInstallState.BackingUp:
        return this._translateService.instant("COMMON.ADDON_STATUS.BACKINGUP");
      case AddonInstallState.Complete:
        return this._translateService.instant("COMMON.ADDON_STATE.UPTODATE");
      case AddonInstallState.Downloading:
        return this._translateService.instant("COMMON.ADDON_STATUS.DOWNLOADING");
      case AddonInstallState.Installing:
        return this._translateService.instant("COMMON.ADDON_STATUS.INSTALLING");
      case AddonInstallState.Pending:
        return this._translateService.instant("COMMON.ADDON_STATUS.PENDING");
      case AddonInstallState.Error:
        return this._translateService.instant("COMMON.ADDON_STATUS.ERROR");
      default:
        return "";
    }
  }
}
