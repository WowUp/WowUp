import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";
import { AddonViewModel } from "app/business-objects/my-addon-list-item";
import { Addon } from "app/entities/addon";
import { AddonDisplayState } from "app/models/wowup/addon-display-state";
import { AddonSearchResult } from "app/models/wowup/addon-search-result";
import { AddonUpdateEvent } from "app/models/wowup/addon-update-event";
import { AddonService } from "app/services/addons/addon.service";
import { SessionService } from "app/services/session/session.service";
import { getEnumName } from "app/utils/enum.utils";
import { MatProgressButtonOptions } from "mat-progress-buttons";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";

@Component({
  selector: "app-addon-install-button",
  templateUrl: "./addon-install-button.component.html",
  styleUrls: ["./addon-install-button.component.scss"],
})
export class AddonInstallButtonComponent implements OnInit, OnDestroy {
  @Input() addon: Addon;
  @Input() hideUninstall = false;

  addonModel: AddonViewModel;

  isInstalled = false;
  btnUninstallOptions: MatProgressButtonOptions;
  btnInstallOptions: MatProgressButtonOptions;

  private _subscriptions: Subscription[];

  get canUninstall(): boolean {
    return this.isInstalled && !this.hideUninstall;
  }

  get shouldDisableInstallButton(): boolean {
    return (
      (!this.addonModel.needsInstall && !this.addonModel.needsUpdate) ||
      this.addonModel.isInstalling
    );
  }

  constructor(
    private _addonService: AddonService,
    private _sessionService: SessionService,
    private _dialog: MatDialog,
    private _translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.addonModel = new AddonViewModel(this.addon);
    this.isInstalled = this._addonService.isInstalled(
      this.addon.externalId,
      this._sessionService.selectedClientType
    );
    this.setButtonOptions();

    const addonUpdateSubscription = this._addonService.addonInstalled$
      .pipe(filter((x) => x.addon.externalId === this.addon.externalId))
      .subscribe((event) => this.onAddonUpdate(event));
    this._subscriptions = [addonUpdateSubscription];
  }

  ngOnDestroy(): void {
    this._subscriptions.forEach((x) => x.unsubscribe());
  }

  onAddonUpdate(event: AddonUpdateEvent): void {
    const addonModel = new AddonViewModel(event.addon);
    addonModel.installProgress = event.progress;
    this.addonModel = addonModel;

    if (event.installState === 4) {
      this.setButtonOptions();
    } else {
      this.updateButtonOptions();
    }
  }

  setButtonOptions(): void {
    this.btnInstallOptions = this.getBaseBtnOptions();
    this.btnUninstallOptions = this.getUninstallBtnOptions();

    if (this.shouldDisableInstallButton) {
      this.btnInstallOptions.disabled = true;
    }
    if (!this.canUninstall) {
      this.btnUninstallOptions.disabled = true;
      this.btnUninstallOptions.active = false;
    }
  }

  updateButtonOptions(): void {
    this.btnInstallOptions.active = this.addonModel.isInstalling;
    this.btnInstallOptions.value = this.addonModel.installProgress;
    this.btnInstallOptions.text = this.addonModel.isInstalling
      ? this.getTranslatedStatusText()
      : this.getTranslatedStateText();
  }

  onInstallUpdateClick(): void {
    this.btnInstallOptions.active = true;
    if (this.addonModel.needsUpdate) {
      this.updateAddon();
    } else if (this.addonModel.needsInstall) {
      this.installAddon();
    }
  }

  onUninstallClick(): void {
    this.confirmRemoveAddon();
  }

  private installAddon() {
    this._addonService.installPotentialAddon(
      this.addonModel.addon as AddonSearchResult,
      this._sessionService.selectedClientType
    );
  }

  private updateAddon() {
    this._addonService.installAddon(this.addonModel.addon.id);
  }

  private confirmRemoveAddon() {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translate.instant("DIALOGS.REMOVE_ADDON.TITLE"),
        message: this._translate.instant("DIALOGS.REMOVE_ADDON.MESSAGE", {
          addon: this.addon.name,
        }),
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }
      this.btnUninstallOptions.active = true;
      this.btnUninstallOptions.text = this._translate.instant(
        "COMMON.ADDON_STATUS.UNINSTALLING"
      );
      this._addonService.removeAddon(this.addonModel.addon);
      // Parent component should listen to addon removed event and make changes.
    });
  }

  private getTranslatedStatusText(): string {
    const status = this.addonModel.statusText;
    return this._translate.instant(
      `COMMON.ADDON_STATUS.${status.toUpperCase()}`
    );
  }

  private getTranslatedStateText(): string {
    const state = this.addonModel.displayState;
    return this._translate.instant(
      `COMMON.ADDON_STATE.${getEnumName(
        AddonDisplayState,
        state
      ).toUpperCase()}`
    );
  }

  private getBaseBtnOptions(): MatProgressButtonOptions {
    return {
      active: this.addonModel.isInstalling,
      disabled: this.shouldDisableInstallButton,
      value: this.addonModel.installProgress,
      text: this.addonModel.isInstalling
        ? this.getTranslatedStatusText()
        : this.getTranslatedStateText(),
      mode: "determinate",
      buttonColor: "primary",
      barColor: "accent",
      customClass: "install-button",
      raised: true,
      stroked: false,
      fullWidth: false,
    };
  }

  private getUninstallBtnOptions(): MatProgressButtonOptions {
    return {
      ...this.getBaseBtnOptions(),
      text: this._translate.instant("COMMON.ADDON_STATE.UNINSTALL"),
      mode: "indeterminate",
      buttonColor: "warn",
      barColor: "primary",
    };
  }
}
