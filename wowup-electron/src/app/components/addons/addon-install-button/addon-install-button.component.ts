import { BehaviorSubject, Subject } from "rxjs";
import { filter, takeUntil } from "rxjs/operators";

import { ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

import { AddonInstallState } from "../../../models/wowup/addon-install-state";
import { AddonUpdateEvent } from "../../../models/wowup/addon-update-event";
import { AddonService } from "../../../services/addons/addon.service";
import { SessionService } from "../../../services/session/session.service";
import { AddonSearchResult } from "wowup-lib-core";

@Component({
  selector: "app-addon-install-button",
  templateUrl: "./addon-install-button.component.html",
  styleUrls: ["./addon-install-button.component.scss"],
})
export class AddonInstallButtonComponent implements OnInit, OnDestroy {
  @Input() public addonSearchResult!: AddonSearchResult;

  @Output() public onViewUpdated: EventEmitter<boolean> = new EventEmitter();

  private readonly _destroy$ = new Subject<boolean>();

  public disableButton$ = new BehaviorSubject<boolean>(false);
  public showProgress$ = new BehaviorSubject<boolean>(false);
  public unavailable$ = new BehaviorSubject<boolean>(false);
  public progressValue$ = new BehaviorSubject<number>(0);
  public buttonText$ = new BehaviorSubject<string>("");

  public constructor(
    private _addonService: AddonService,
    private _sessionService: SessionService,
    private _translate: TranslateService,
    private _cdRef: ChangeDetectorRef
  ) {
    this._addonService.addonInstalled$
      .pipe(takeUntil(this._destroy$), filter(this.isSameAddon))
      .subscribe(this.onAddonInstalledUpdate);
  }

  public ngOnInit(): void {
    const selectedInstallation = this._sessionService.getSelectedWowInstallation();
    if (!selectedInstallation) {
      console.warn("No selected installation");
      return;
    }

    this.unavailable$.next(this.addonSearchResult.externallyBlocked);

    this._addonService
      .isInstalled(this.addonSearchResult.externalId, this.addonSearchResult.providerName, selectedInstallation)
      .then((isInstalled) => {
        this.disableButton$.next(this.addonSearchResult.externallyBlocked || isInstalled);

        if (this.addonSearchResult.externallyBlocked) {
          this.buttonText$.next(this._translate.instant("COMMON.ADDON_STATE.UNAVAILABLE") as string);
        } else {
          this.buttonText$.next(
            this.getButtonText(isInstalled ? AddonInstallState.Complete : AddonInstallState.Unknown)
          );
        }
      })
      .catch((e) => console.error(e));
  }

  public ngOnDestroy(): void {
    this._destroy$.next(true);
  }

  public getIsButtonActive(installState: AddonInstallState): boolean {
    return installState !== AddonInstallState.Unknown && installState !== AddonInstallState.Complete;
  }

  public getIsButtonDisabled(installState: AddonInstallState): boolean {
    return installState !== AddonInstallState.Unknown;
  }

  public getInstallStateText(installState: AddonInstallState): string {
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

  public getButtonText(installState: AddonInstallState): string {
    if (installState !== AddonInstallState.Unknown) {
      return this.getInstallStateText(installState);
    }

    return this._translate.instant("COMMON.ADDON_STATE.INSTALL");
  }

  public async onInstallUpdateClick(): Promise<void> {
    const selectedInstallation = this._sessionService.getSelectedWowInstallation();
    if (!selectedInstallation) {
      console.warn("No selected installation");
      return;
    }

    this.disableButton$.next(true);
    try {
      await this._addonService.installPotentialAddon(this.addonSearchResult, selectedInstallation);
    } catch (e) {
      console.error("onInstallUpdateClick failed", e);
      console.error(this.addonSearchResult);
      this.disableButton$.next(false);
    }
  }

  private onAddonInstalledUpdate = (evt: AddonUpdateEvent): void => {
    this.showProgress$.next(this.getIsButtonActive(evt.installState));
    this.disableButton$.next(this.getIsButtonDisabled(evt.installState));
    this.progressValue$.next(evt.progress);
    this.buttonText$.next(this.getButtonText(evt.installState));
    this.onViewUpdated.emit(true);
    this._cdRef.detectChanges();
  };

  private isSameAddon = (evt: AddonUpdateEvent): boolean => {
    return (
      evt.addon.externalId === this.addonSearchResult.externalId &&
      evt.addon.providerName === this.addonSearchResult.providerName
    );
  };
}
