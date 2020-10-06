import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { AddonModel } from "app/business-objects/my-addons-list-item";
import { Addon } from "app/entities/addon";
import { AddonUpdateEvent } from "app/models/wowup/addon-update-event";
import { PotentialAddon } from "app/models/wowup/potential-addon";
import { AddonService } from "app/services/addons/addon.service";
import { SessionService } from "app/services/session/session.service";
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
    private _dialog: MatDialog
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
    this.btnInstallOptions.text = "Installing...";
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
    this.btnInstallOptions.text = "Updating...";
    this._addonService.installAddon(
      this.addonModel.addon.id,
      (state, progress) => {
        this.addonModel.updateInstallState(state);
        this.addonModel.installProgress = progress;
        this.btnInstallOptions.value = progress;
      }
    );
  }

  private confirmRemoveAddon() {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Uninstall Addon?`,
        message: `Are you sure you want to remove ${this.addon.name}?\nThis will remove all related folders from your World of Warcraft folder.`,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }
      this.btnUninstallOptions.active = true;
      this.btnUninstallOptions.text = "Uninstalling...";
      this._addonService.removeAddon(this.addonModel.addon);
      // Parent component should listen to addon removed event and make changes.
    });
  }

  private getBaseBtnOptions(): MatProgressButtonOptions {
    return {
      active: false,
      text: this.addonModel.statusText,
      buttonColor: "primary",
      barColor: "accent",
      customClass: "install-button",
      raised: true,
      stroked: false,
      mode: "determinate",
      value: this.addonModel.installProgress,
      disabled: false,
      fullWidth: false,
    };
  }

  private getUninstallBtnOptions(): MatProgressButtonOptions {
    return {
      ...this.getBaseBtnOptions(),
      text: "Uninstall",
      mode: "indeterminate",
      buttonColor: "warn",
      barColor: "primary",
    };
  }
}
