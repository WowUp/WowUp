import { Injectable } from "@angular/core";
import { catchError, EMPTY, from, mergeMap, Subject } from "rxjs";
import { Addon, getEnumName, WowClientType } from "wowup-lib-core";

import { USER_ACTION_ADDON_INSTALL } from "../../../common/constants";
import { AddonInstallPhase } from "../../../common/models/addon-install";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { capitalizeString } from "../../utils/string.utils";
import { AnalyticsService } from "../analytics/analytics.service";
import { AddonInstallApiService } from "../api/addon-install-api.service";

export type InstallType = "install" | "update" | "remove";

export interface InstallQueueItem {
  addon: Addon;
  onUpdate: (installState: AddonInstallState, progress: number) => void | undefined | Promise<void>;
  completion: any;
  originalAddon?: Addon;
  installType: InstallType;
}

const PHASE_STATES: Record<AddonInstallPhase, { installState: AddonInstallState; progress: number }> = {
  downloading: { installState: AddonInstallState.Downloading, progress: 25 },
  retry: { installState: AddonInstallState.Retry, progress: 0 },
  backingUp: { installState: AddonInstallState.BackingUp, progress: 50 },
  installing: { installState: AddonInstallState.Installing, progress: 75 },
};

/**
 * The install queue: up to 3 at a time, each one a single call to main, which downloads the addon
 * (retrying with a fresh url), installs it and looks up its hub id (`AddonInstallApiService`).
 */
@Injectable({
  providedIn: "root",
})
export class AddonInstallService {
  private readonly _installQueue = new Subject<InstallQueueItem>();
  private readonly _installErrorSrc = new Subject<Error>();
  private readonly _addonInstalledSrc = new Subject<AddonUpdateEvent>();

  public readonly addonInstalled$ = this._addonInstalledSrc.asObservable();
  public readonly installError$ = this._installErrorSrc.asObservable();

  public constructor(
    private _analyticsService: AnalyticsService,
    private _addonInstallApiService: AddonInstallApiService,
  ) {
    // Setup our install queue pump here. An error escaping one item must not reach the outer
    // pipe, or the subscription ends and every later item waits forever.
    this._installQueue
      .pipe(
        mergeMap(
          (item) =>
            from(this.processInstallQueue(item)).pipe(
              catchError((error: Error) => {
                console.error(error);
                item.completion.reject(error);
                this._installErrorSrc.next(error);
                // Settle the row too, it would show as installing forever otherwise
                this._addonInstalledSrc.next({
                  addon: item.addon,
                  installState: AddonInstallState.Error,
                  progress: 100,
                  error,
                });
                return EMPTY;
              }),
            ),
          3,
        ),
      )
      .subscribe((addonName) => {
        console.log("Install complete", addonName);
      });
  }

  public enqueue(queueItem: InstallQueueItem): void {
    // Lets the grids show a row as pending while it waits for a free slot in the queue
    this._addonInstalledSrc.next({
      addon: queueItem.addon,
      installState: AddonInstallState.Pending,
      progress: 0,
    });
    this._installQueue.next(queueItem);
  }

  private processInstallQueue = async (queueItem: InstallQueueItem): Promise<string> => {
    const onUpdate = queueItem.onUpdate;

    const addon = queueItem.addon;

    this.logAddonAction(
      `Addon${capitalizeString(queueItem.installType)}`,
      addon,
      `'${addon.installedVersion ?? ""}' -> '${addon.latestVersion ?? ""}'`,
    );

    try {
      const installed = await this._addonInstallApiService.install(
        { addon, originalAddon: queueItem.originalAddon },
        (phase) => this.reportPhase(queueItem, phase),
      );
      // Callers and the grids hold this object, so the saved result goes onto it rather than replacing it
      Object.assign(addon, installed.addon);

      this.trackInstallAction(queueItem.installType, addon);
      for (const removed of installed.removedAddons) {
        this.trackInstallAction("remove", removed);
      }

      queueItem.completion.resolve();

      this.reportState(queueItem, AddonInstallState.Complete, 100);

      this.logAddonAction(
        `Addon${capitalizeString(queueItem.installType)}Complete`,
        addon,
        addon.installedVersion ?? "",
      );
    } catch (err) {
      console.error(err);
      queueItem.completion.reject(err);

      onUpdate?.call(this, AddonInstallState.Error, 100);
      this._addonInstalledSrc.next({
        addon,
        installState: AddonInstallState.Error,
        progress: 100,
        error: err instanceof Error ? err : undefined,
      });
    }
    return addon.name;
  };

  private reportPhase(queueItem: InstallQueueItem, phase: AddonInstallPhase): void {
    const { installState, progress } = PHASE_STATES[phase];
    // A retry only shows on the grids; the caller's callback never heard about one
    if (installState === AddonInstallState.Retry) {
      this._addonInstalledSrc.next({ addon: queueItem.addon, installState, progress });
      return;
    }
    this.reportState(queueItem, installState, progress);
  }

  private reportState(queueItem: InstallQueueItem, installState: AddonInstallState, progress: number): void {
    queueItem.onUpdate?.call(this, installState, progress);
    this._addonInstalledSrc.next({ addon: queueItem.addon, installState, progress });
  }

  private logAddonAction(action: string, addon: Addon, ...extras: string[]) {
    console.log(
      `[${action}] ${addon.providerName ?? ""} ${addon.externalId ?? "NO_EXT_ID"} ${addon.name} ${extras.join(" ")}`,
    );
  }

  private trackInstallAction(installType: InstallType, addon: Addon) {
    this._analyticsService.trackAction(USER_ACTION_ADDON_INSTALL, {
      clientType: getEnumName(WowClientType, addon.clientType),
      provider: addon.providerName,
      addon: addon.name,
      addonId: addon.externalId,
      installType,
    });
  }
}
