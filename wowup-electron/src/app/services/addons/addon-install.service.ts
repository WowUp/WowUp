import { Injectable } from "@angular/core";
import { catchError, EMPTY, from, mergeMap, Subject } from "rxjs";
import slug from "slug";
import { join as pathJoin } from "path";
import { Addon, getEnumName, WowClientType, WowUpAddonProvider } from "wowup-lib-core";

import { ADDON_PROVIDER_HUB, USER_ACTION_ADDON_INSTALL } from "../../../common/constants";
import { AddonInstallPhase } from "../../../common/models/addon-install";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { capitalizeString } from "../../utils/string.utils";
import { delayMs } from "../../utils/time.utils";
import { AnalyticsService } from "../analytics/analytics.service";
import { AddonInstallApiService } from "../api/addon-install-api.service";
import { AddonScanApiService } from "../api/addon-scan-api.service";
import { DownloadOptions, DownloadService } from "../download/download.service";
import { FileService } from "../files/file.service";
import { WarcraftInstallationService } from "../warcraft/warcraft-installation.service";
import { WarcraftService } from "../warcraft/warcraft.service";
import { WowUpService } from "../wowup/wowup.service";
import { AddonProviderFactory } from "./addon.provider.factory";

export type InstallType = "install" | "update" | "remove";

export interface InstallQueueItem {
  addon: Addon;
  onUpdate: (installState: AddonInstallState, progress: number) => void | undefined | Promise<void>;
  completion: any;
  originalAddon?: Addon;
  installType: InstallType;
}

const PHASE_STATES: Record<AddonInstallPhase, { installState: AddonInstallState; progress: number }> = {
  backingUp: { installState: AddonInstallState.BackingUp, progress: 50 },
  installing: { installState: AddonInstallState.Installing, progress: 75 },
};

/**
 * The install queue. Each item is downloaded here, because a failed download is retried after the
 * addon's provider refreshes its url and the providers live in the renderer, then main installs the
 * zip (`AddonInstallApiService`). The hub id lookup afterwards also needs a provider, so it runs here.
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
    private _warcraftInstallationService: WarcraftInstallationService,
    private _addonProviderService: AddonProviderFactory,
    private _wowUpService: WowUpService,
    private _warcraftService: WarcraftService,
    private _downloadService: DownloadService,
    private _fileService: FileService,
    private _analyticsService: AnalyticsService,
    private _addonScanApiService: AddonScanApiService,
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

    const downloadFileName = `${slug(addon.name)}.zip`;

    let downloadedFilePath = "";

    try {
      const installation = this._warcraftInstallationService.getWowInstallation(addon.installationId);
      if (!installation) {
        throw new Error(`Installation not found: ${addon.installationId ?? ""}`);
      }

      const addonProvider = this._addonProviderService.getProvider(addon.providerName ?? "");
      if (!addonProvider) {
        throw new Error(`Addon provider not found: ${addon.providerName ?? ""}`);
      }

      this.reportState(queueItem, AddonInstallState.Downloading, 25);

      const downloadAuth = await addonProvider.getDownloadAuth();
      console.debug(`Download auth for ${addon.name}:`, downloadAuth);

      let retryCt = 0;
      while (downloadedFilePath.length === 0) {
        const downloadOptions: DownloadOptions = {
          fileName: downloadFileName,
          outputFolder: this._wowUpService.applicationDownloadsFolderPath,
          url: addon.downloadUrl ?? "",
          auth: downloadAuth,
        };

        try {
          downloadedFilePath = await this._downloadService.downloadZipFile(downloadOptions);
        } catch (e) {
          if (retryCt === 3) {
            throw e;
          }
          retryCt += 1;
          const backoffMs = 1000 * Math.pow(2, retryCt - 1);
          console.log(`install download failed, retry ${retryCt} in ${backoffMs}ms`);

          this._addonInstalledSrc.next({
            addon,
            installState: AddonInstallState.Retry,
            progress: 0,
          });
          // The caller re-syncs the addon here, which can hand it a fresh download url
          await onUpdate?.call(this, AddonInstallState.Retry, 0);
          await delayMs(backoffMs);
        }
      }

      const installed = await this._addonInstallApiService.installFile(
        {
          addon,
          zipFilePath: downloadedFilePath,
          originalAddon: queueItem.originalAddon,
          forceIgnore: addonProvider.forceIgnore,
          providerNames: this._addonProviderService.getProviderNames(),
        },
        (phase) => this.reportState(queueItem, PHASE_STATES[phase].installState, PHASE_STATES[phase].progress),
      );
      // Callers and the grids hold this object, so the saved result goes onto it rather than replacing it
      Object.assign(addon, installed.addon);

      this.trackInstallAction(queueItem.installType, addon);
      for (const removed of installed.removedAddons) {
        this.trackInstallAction("remove", removed);
      }

      await this.addHubExternalId(addon);

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
    } finally {
      // Main deletes the zip once it has it; this catches a failure before it got that far
      if (downloadedFilePath && (await this._fileService.pathExists(downloadedFilePath))) {
        await this._fileService.remove(downloadedFilePath);
      }
    }
    return addon.name;
  };

  private reportState(queueItem: InstallQueueItem, installState: AddonInstallState, progress: number): void {
    queueItem.onUpdate?.call(this, installState, progress);
    this._addonInstalledSrc.next({ addon: queueItem.addon, installState, progress });
  }

  private logAddonAction(action: string, addon: Addon, ...extras: string[]) {
    console.log(
      `[${action}] ${addon.providerName ?? ""} ${addon.externalId ?? "NO_EXT_ID"} ${addon.name} ${extras.join(" ")}`,
    );
  }

  /**
   * The hub has no toc field and can only be matched by fingerprint, so an addon installed from
   * another provider never learns its hub id from its tocs. Ask the hub about the installed
   * folders instead. Best effort: a hub failure must never fail the install.
   */
  private async addHubExternalId(addon: Addon): Promise<void> {
    if (
      addon.providerName === ADDON_PROVIDER_HUB ||
      !addon.installationId ||
      !addon.installedFolderList?.length ||
      addon.externalIds?.some((extId) => extId.providerName === ADDON_PROVIDER_HUB)
    ) {
      return;
    }

    const hubProvider = this._addonProviderService.getProvider<WowUpAddonProvider>(ADDON_PROVIDER_HUB);
    const installation = this._warcraftInstallationService.getWowInstallation(addon.installationId);
    if (!hubProvider?.enabled || !installation) {
      return;
    }

    try {
      const addonFolderPath = this._warcraftService.getAddonFolderPath(installation);
      const folderPaths = addon.installedFolderList.map((folderName) => pathJoin(addonFolderPath, folderName));
      const scanResults = await this._addonScanApiService.getScanResults(folderPaths, ["wowup"]);
      const fingerprints = scanResults.map((result) => result.wowup?.fingerprint).filter((fp): fp is string => !!fp);

      const hubIds = await hubProvider.getAddonIdsByFingerprints(fingerprints);
      const hubId = fingerprints.map((fp) => hubIds.get(fp)).find((id) => id !== undefined);
      if (!hubId) {
        return;
      }

      const externalIds = await this._addonInstallApiService.addExternalId({
        addonId: addon.id,
        providerName: ADDON_PROVIDER_HUB,
        externalId: hubId,
      });
      if (externalIds) {
        addon.externalIds = externalIds;
      }
    } catch (e) {
      console.error(`Failed to look up hub id for ${addon.name}`, e);
    }
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
