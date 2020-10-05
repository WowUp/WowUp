import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { AddonDetailModel } from "app/models/wowup/addon-detail.model";
import { AddonInstallState } from "app/models/wowup/addon-install-state";
import { AddonUpdateEvent } from "app/models/wowup/addon-update-event";
import { PotentialAddon } from "app/models/wowup/potential-addon";
import { AddonService } from "app/services/addons/addon.service";
import { SessionService } from "app/services/session/session.service";
import { MatProgressButtonOptions } from "mat-progress-buttons";
import { Subscription } from "rxjs";
import { filter, map } from "rxjs/operators";

@Component({
  selector: "app-addon-install-button",
  templateUrl: "./addon-install-button.component.html",
  styleUrls: ["./addon-install-button.component.scss"],
})
export class AddonInstallButtonComponent implements OnInit, OnDestroy {
  @Input("addon") addon: PotentialAddon | AddonDetailModel;

  isInstalled: boolean;
  canUninstall: boolean;
  hasUpdate: boolean;
  buttonOptions: MatProgressButtonOptions;

  private _subscriptions: Subscription[];

  constructor(
    private _addonService: AddonService,
    private _sessionService: SessionService
  ) {}

  ngOnInit(): void {
    this.isInstalled = this._addonService.isInstalled(
      this.addon.externalId,
      this._sessionService.selectedClientType
    );
    this.setButtonOptions();
    const addonUpdateSubscription = this._addonService.addonInstalled$
      .pipe(
        filter((x) => x.addon.externalId === this.addon.externalId),
        map((event: AddonUpdateEvent) => {
          if (event.installState === AddonInstallState.Complete) {
            this.isInstalled = true;
            this.setButtonOptions();
          }
        })
      )
      .subscribe();
    this._subscriptions = [addonUpdateSubscription];
  }

  ngOnDestroy(): void {
    this._subscriptions.forEach((x) => x.unsubscribe());
  }

  setButtonOptions(): void {
    if (!this.isInstalled) {
      this.buttonOptions = this.getBaseBtnOptions();
    } else if (this.isInstalled && !this.canUninstall) {
      this.buttonOptions = this.getInstalledBtnOptions();
    } else if (this.isInstalled && this.canUninstall) {
      this.buttonOptions = this.getUninstallBtnOptions();
    } else if (this.isInstalled && this.hasUpdate) {
      this.buttonOptions = this.getUpdateBtnOptions();
    }
  }

  onButtonClick(): void {
    this.buttonOptions.active = true;
    this.buttonOptions.text = "Installing...";
    this._addonService.installPotentialAddon(
      this.addon as PotentialAddon,
      this._sessionService.selectedClientType,
      (state, progress) => {
        if (state === AddonInstallState.Complete) {
          this.isInstalled = true;
          this.setButtonOptions();
        }
        this.buttonOptions.value = progress;
      }
    );
  }

  private getBaseBtnOptions(): MatProgressButtonOptions {
    return {
      active: false,
      text: "Install",
      buttonColor: "primary",
      barColor: "accent",
      customClass: "install-button",
      raised: true,
      stroked: false,
      mode: "determinate",
      value: 0,
      disabled: false,
      fullWidth: false,
    };
  }

  private getInstalledBtnOptions(): MatProgressButtonOptions {
    return {
      ...this.getBaseBtnOptions(),
      disabled: true,
      active: false,
      text: "Installed",
    };
  }

  private getUninstallBtnOptions(): MatProgressButtonOptions {
    return {
      ...this.getBaseBtnOptions(),
      text: "Uninstall",
    };
  }

  private getUpdateBtnOptions(): MatProgressButtonOptions {
    return {
      ...this.getBaseBtnOptions(),
      text: "Update",
    };
  }
}
