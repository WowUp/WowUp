import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";
import { AddonModel } from "app/business-objects/my-addons-list-item";
import { Addon } from "app/entities/addon";
import { AddonDisplayState } from "app/models/wowup/addon-display-state";
import { AddonUpdateEvent } from "app/models/wowup/addon-update-event";
import { PotentialAddon } from "app/models/wowup/potential-addon";
import { AddonService } from "app/services/addons/addon.service";
import { SessionService } from "app/services/session/session.service";
import { getEnumName } from "app/utils/enum.utils";
import { MatProgressButtonOptions } from "mat-progress-buttons";
import { Subscription } from "rxjs";
import { filter, map } from "rxjs/operators";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";

@Component({
  selector: "app-addon-install-button",
  templateUrl: "./addon-install-button.component.html",
  styleUrls: ["./addon-install-button.component.scss"],
})
export class AddonInstallButtonComponent implements OnInit, OnDestroy {
  @Input() addon: Addon;
  @Input() hideUninstall = false;

  addonModel: AddonModel;

  isInstalled = false;
  btnUninstallOptions: MatProgressButtonOptions;
  btnInstallOptions: MatProgressButtonOptions;

  private _subscriptions: Subscription[];

  get canUninstall(): boolean {
    return this.isInstalled && !this.hideUninstall;
  }

  constructor(
    private _addonService: AddonService,
    private _sessionService: SessionService,
    private _dialog: MatDialog,
    private _translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.addonModel = new AddonModel(this.addon);
    this.isInstalled = this._addonService.isInstalled(
      this.addon.externalId,
      this._sessionService.selectedClientType
    );
    this.setButtonOptions();

    const addonUpdateSubscription = this._addonService.addonInstalled$
      .pipe(
        filter(
          (x) =>
            x.addon.externalId === this.addon.externalId && x.installState == 4
        ),
        map((event: AddonUpdateEvent) => {
          const addonModel = new AddonModel(event.addon);
          addonModel.updateInstallState(event.installState);
          addonModel.setStatusText(event.installState);
          addonModel.installProgress = event.progress;
          this.addonModel = addonModel;
          this.setButtonOptions();
        })
      )
      .subscribe();
    this._subscriptions = [addonUpdateSubscription];
  }

  ngOnDestroy(): void {
    this._subscriptions.forEach((x) => x.unsubscribe());
  }

  setButtonOptions(): void {
    this.btnInstallOptions = this.getBaseBtnOptions();
    this.btnUninstallOptions = this.getUninstallBtnOptions();
    if (!this.addonModel.needsInstall && !this.addonModel.needsUpdate) {
      this.btnInstallOptions.disabled = true;
      this.btnInstallOptions.active = false;
    }
    if (!this.canUninstall) {
      this.btnUninstallOptions.disabled = true;
      this.btnUninstallOptions.active = false;
    }
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
    this.btnInstallOptions.text = this._translate.instant(
      "COMMON.ADDON_STATUS.INSTALLING"
    );
    this._addonService.installPotentialAddon(
      this.addonModel.addon as PotentialAddon,
      this._sessionService.selectedClientType,
      (state, progress) => {
        this.addonModel.updateInstallState(state);
        this.addonModel.installProgress = progress;
        this.btnInstallOptions.value = progress;
      }
    );
  }

  private updateAddon() {
    this.btnInstallOptions.text = this._translate.instant(
      "COMMON.ADDON_STATUS.UPDATING"
    );
    this._addonService.installAddon(
      this.addonModel.addon.id,
      (state, progress) => {
        console.log(
          "AddonInstallButtonComponent -> updateAddon -> state",
          state
        );
        this.addonModel.updateInstallState(state);
        this.addonModel.installProgress = progress;
        this.btnInstallOptions.value = progress;
      }
    );
  }

  private confirmRemoveAddon() {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title:  this._translate.instant('DIALOGS.REMOVE_ADDON.TITLE'),
        message: this._translate.instant('DIALOGS.REMOVE_ADDON.MESSAGE', { addon: this.addon.name })
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
      active: false,
      text: this.getTranslatedStateText(),
      buttonColor: "primary",
      barColor: "accent",
      customClass: "install-button",
      raised: true,
      stroked: false,
      mode: "determinate",
      disabled: false,
      fullWidth: false,
      value: this.addonModel.installProgress,
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
