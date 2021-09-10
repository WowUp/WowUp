import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";

import { ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

import { WowClientType } from "../../../../common/warcraft/wow-client-type";
import { AddonViewModel } from "../../../business-objects/addon-view-model";
import { AddonInstallState } from "../../../models/wowup/addon-install-state";
import { AddonUpdateEvent } from "../../../models/wowup/addon-update-event";
import { AddonService } from "../../../services/addons/addon.service";
import { getEnumName } from "../../../utils/enum.utils";
import { ADDON_PROVIDER_UNKNOWN } from "../../../../common/constants";

@Component({
  selector: "app-addon-update-button",
  templateUrl: "./addon-update-button.component.html",
  styleUrls: ["./addon-update-button.component.scss"],
})
export class AddonUpdateButtonComponent implements OnInit, OnDestroy {
  @Input() public listItem!: AddonViewModel;
  @Input() public extInstallState?: AddonInstallState;
  @Input() public value?: number;

  @Output() public onViewUpdated: EventEmitter<boolean> = new EventEmitter();

  private _subscriptions: Subscription[] = [];

  public installState = AddonInstallState.Unknown;
  public installProgress = 0;
  public providerName = "";
  public externalId = "";

  public constructor(
    private _addonService: AddonService,
    private _translateService: TranslateService,
    private _cdRef: ChangeDetectorRef
  ) {
    const addonInstalledSub = this._addonService.addonInstalled$
      .pipe(filter(this.isSameAddon))
      .subscribe(this.onAddonInstalledUpdate);

    this._subscriptions.push(addonInstalledSub);
  }

  public ngOnInit(): void {
    if (this.listItem.addon?.providerName === ADDON_PROVIDER_UNKNOWN) {
      return;
    }

    if (
      this.listItem.addon === undefined ||
      !this.listItem.addon.id ||
      !this.listItem.addon.externalId ||
      !this.listItem.addon.providerName
    ) {
      console.warn("Invalid list item addon", this.listItem);
      return;
    }

    this.providerName = this.listItem.addon.providerName;
    this.externalId = this.listItem.addon.externalId;
    this.installProgress = this.value ?? 0;

    const installStatus = this._addonService.getInstallStatus(this.listItem.addon.id);
    if (installStatus) {
      this.installProgress = installStatus.progress;
      this.installState = installStatus.installState;
    }
  }

  public ngOnDestroy(): void {
    this._subscriptions.forEach((sub) => sub.unsubscribe());
  }

  public getActionLabel(): string {
    return `${getEnumName(WowClientType, this.listItem?.addon?.clientType)}|${
      this.listItem?.addon?.providerName ?? ""
    }|${this.listItem?.addon?.externalId ?? ""}|${this.listItem?.addon?.name ?? ""}`;
  }

  public getIsButtonActive(): boolean {
    return (
      this.installState !== AddonInstallState.Unknown &&
      this.installState !== AddonInstallState.Complete &&
      this.installState !== AddonInstallState.Error
    );
  }

  public getIsButtonDisabled(): boolean {
    return this.listItem?.isUpToDate() || this.installState < AddonInstallState.Unknown;
  }

  public getButtonText(): string {
    if (this.installState !== AddonInstallState.Unknown) {
      return this.getInstallStateText(this.installState);
    }

    return this.getStatusText();
  }

  public async onInstallUpdateClick(): Promise<void> {
    try {
      if (!this.listItem?.addon?.id) {
        throw new Error("Invalid list item addon");
      }

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

  private onAddonInstalledUpdate = (evt: AddonUpdateEvent) => {
    this.installState = evt.installState;
    this.installProgress = evt.progress;
    this._cdRef.detectChanges();
  };

  private isSameAddon = (evt: AddonUpdateEvent) => {
    return evt.addon.externalId === this.externalId && evt.addon.providerName === this.providerName;
  };

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
