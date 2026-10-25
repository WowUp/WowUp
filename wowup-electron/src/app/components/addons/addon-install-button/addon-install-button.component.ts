import { BehaviorSubject, Subject } from "rxjs";
import { filter, takeUntil } from "rxjs/operators";

import { ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

import { AddonInstallState } from "../../../models/wowup/addon-install-state";
import { AddonUpdateEvent } from "../../../models/wowup/addon-update-event";
import { AddonService, DependencyInstallEvent, DependencyInstallState } from "../../../services/addons/addon.service";
import { SessionService } from "../../../services/session/session.service";
import { Addon, AddonSearchResult } from "wowup-lib-core";

@Component({
  selector: "app-addon-install-button",
  templateUrl: "./addon-install-button.component.html",
  styleUrls: ["./addon-install-button.component.scss"],
})
export class AddonInstallButtonComponent implements OnInit, OnDestroy {
  @Input() public addonSearchResult!: AddonSearchResult;

  @Output() public onViewUpdated: EventEmitter<boolean> = new EventEmitter();

  private readonly _destroy$ = new Subject<boolean>();
  private _showingDependencies = false;

  public disableButton$ = new BehaviorSubject<boolean>(false);
  public showProgress$ = new BehaviorSubject<boolean>(false);
  public unavailable$ = new BehaviorSubject<boolean>(false);
  public progressValue$ = new BehaviorSubject<number>(0);
  public buttonText$ = new BehaviorSubject<string>("");

  public constructor(
    private _addonService: AddonService,
    private _sessionService: SessionService,
    private _translate: TranslateService,
    private _cdRef: ChangeDetectorRef,
  ) {
    this._addonService.addonInstalled$
      .pipe(takeUntil(this._destroy$), filter(this.isSameAddon))
      .subscribe(this.onAddonInstalledUpdate);

    this._addonService.dependencyInstall$
      .pipe(takeUntil(this._destroy$), filter(this.isSameAddon))
      .subscribe(this.onDependencyInstallUpdate);
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
            this.getButtonText(isInstalled ? AddonInstallState.Complete : AddonInstallState.Unknown),
          );
        }

        // A row can be (re)created while the addon's dependencies are still installing
        const dependencyStatus = this.getDependencyInstallStatus();
        if (dependencyStatus) {
          this.onDependencyInstallUpdate(dependencyStatus);
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
    // The addon itself is done, but it isn't installed until its dependencies are
    const dependencyStatus =
      evt.installState === AddonInstallState.Complete ? this.getDependencyInstallStatus() : undefined;
    if (dependencyStatus) {
      this.onDependencyInstallUpdate(dependencyStatus);
      return;
    }

    this._showingDependencies = false;
    this.showProgress$.next(this.getIsButtonActive(evt.installState));
    this.disableButton$.next(this.getIsButtonDisabled(evt.installState));
    this.progressValue$.next(evt.progress);
    this.buttonText$.next(this.getButtonText(evt.installState));
    this.onViewUpdated.emit(true);
    this._cdRef.detectChanges();
  };

  private onDependencyInstallUpdate = (evt: DependencyInstallEvent): void => {
    if (evt.state === DependencyInstallState.Complete) {
      // Only finish what this button showed, an addon that failed to install also drops its dependencies
      if (this._showingDependencies) {
        this._showingDependencies = false;
        this.onAddonInstalledUpdate({ addon: evt.addon, installState: AddonInstallState.Complete, progress: 100 });
      }
      return;
    }

    this._showingDependencies = true;
    const progress = evt.total > 0 ? (evt.completed / evt.total) * 100 : 0;
    this.showProgress$.next(true);
    this.disableButton$.next(true);
    this.progressValue$.next(progress);
    this.buttonText$.next(this.getDependencyStateText(evt));
    this.onViewUpdated.emit(true);
    this._cdRef.detectChanges();
  };

  private getDependencyStateText(evt: DependencyInstallEvent): string {
    if (evt.state === DependencyInstallState.Resolving) {
      return this._translate.instant("COMMON.ADDON_STATUS.CHECKING_DEPENDENCIES") as string;
    }

    return this._translate.instant("COMMON.ADDON_STATUS.INSTALLING_DEPENDENCIES", {
      completed: evt.completed,
      total: evt.total,
    }) as string;
  }

  private getDependencyInstallStatus(): DependencyInstallEvent | undefined {
    const selectedInstallation = this._sessionService.getSelectedWowInstallation();
    return this._addonService
      .getDependencyInstallStatuses()
      .find((status) => this.isSameAddon(status) && status.addon.installationId === selectedInstallation?.id);
  }

  private isSameAddon = (evt: { addon: Addon }): boolean => {
    return (
      evt.addon.externalId === this.addonSearchResult.externalId &&
      evt.addon.providerName === this.addonSearchResult.providerName
    );
  };
}
