import * as _ from "lodash";
import { nanoid } from "nanoid";
import * as path from "path";
import { BehaviorSubject, firstValueFrom, forkJoin, from, Observable, of, Subject, Subscription } from "rxjs";
import { catchError, filter, first, map, mergeMap, switchMap, tap } from "rxjs/operators";
import * as slug from "slug";
import { v4 as uuidv4 } from "uuid";

import { Injectable } from "@angular/core";

import {
  ADDON_PROVIDER_CURSEFORGE,
  ADDON_PROVIDER_CURSEFORGEV2,
  ADDON_PROVIDER_HUB,
  ADDON_PROVIDER_HUB_LEGACY,
  ADDON_PROVIDER_RAIDERIO,
  ADDON_PROVIDER_TUKUI,
  ADDON_PROVIDER_UNKNOWN,
  ADDON_PROVIDER_WAGO,
  ADDON_PROVIDER_WOWINTERFACE,
  ADDON_PROVIDER_WOWUP_COMPANION,
  ADDON_PROVIDER_ZIP,
  ERROR_ADDON_ALREADY_INSTALLED,
  USER_ACTION_ADDON_INSTALL,
  USER_ACTION_ADDON_PROTOCOL_SEARCH,
  USER_ACTION_ADDON_SEARCH,
  USER_ACTION_BROWSE_CATEGORY,
} from "../../../common/constants";
import { Addon, AddonExternalId } from "../../../common/entities/addon";
import { WowClientType } from "../../../common/warcraft/wow-client-type";
import {
  AddonCategory,
  AddonChannelType,
  AddonDependency,
  AddonDependencyType,
  AddonWarningType,
} from "../../../common/wowup/models";
import { AddonProvider, SearchByUrlResult } from "../../addon-providers/addon-provider";
// import { CurseAddonProvider } from "../../addon-providers/curse-addon-provider";
import { WowUpAddonProvider } from "../../addon-providers/wowup-addon-provider";
import { AddonScanError, AddonSyncError, GenericProviderError } from "../../errors";
import { AddonFolder } from "../../models/wowup/addon-folder";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { AddonSearchResult } from "../../models/wowup/addon-search-result";
import { AddonSearchResultDependency } from "../../models/wowup/addon-search-result-dependency";
import { AddonSearchResultFile } from "../../models/wowup/addon-search-result-file";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { ProtocolSearchResult } from "../../models/wowup/protocol-search-result";
import { Toc } from "../../models/wowup/toc";
import { WowInstallation } from "../../../common/warcraft/wow-installation";
import * as AddonUtils from "../../utils/addon.utils";
import { getEnumName } from "../../utils/enum.utils";
import * as SearchResults from "../../utils/search-result.utils";
import { capitalizeString } from "../../utils/string.utils";
import { AnalyticsService } from "../analytics/analytics.service";
import { DownloadOptions, DownloadService } from "../download/download.service";
import { FileService } from "../files/file.service";
import { AddonStorageService } from "../storage/addon-storage.service";
import { TocService } from "../toc/toc.service";
import { WarcraftInstallationService } from "../warcraft/warcraft-installation.service";
import { WarcraftService } from "../warcraft/warcraft.service";
import { WowUpService } from "../wowup/wowup.service";
import { AddonProviderFactory } from "./addon.provider.factory";
import { AddonFingerprintService } from "./addon-fingerprint.service";

export enum ScanUpdateType {
  Start,
  Update,
  Complete,
  Unknown,
}

export interface ScanUpdate {
  type: ScanUpdateType;
  totalCount?: number;
  currentCount?: number;
}

type InstallType = "install" | "update" | "remove";

export type AddonActionType = "scan" | "sync";
export interface AddonActionEvent {
  type: AddonActionType;
  addon?: Addon;
}

interface InstallQueueItem {
  addonId: string;
  onUpdate: (installState: AddonInstallState, progress: number) => void | undefined;
  completion: any;
  originalAddon?: Addon;
  installType: InstallType;
}

const IGNORED_FOLDER_NAMES = ["__MACOSX"];

const ADDON_PROVIDER_TOC_EXTERNAL_ID_MAP = {
  [ADDON_PROVIDER_WOWINTERFACE]: "wowInterfaceId",
  [ADDON_PROVIDER_TUKUI]: "tukUiProjectId",
  [ADDON_PROVIDER_CURSEFORGE]: "curseProjectId",
  [ADDON_PROVIDER_CURSEFORGEV2]: "curseProjectId",
  [ADDON_PROVIDER_WAGO]: "wagoAddonId",
};

@Injectable({
  providedIn: "root",
})
export class AddonService {
  private readonly _addonActionSrc = new Subject<AddonActionEvent>();
  private readonly _addonInstalledSrc = new Subject<AddonUpdateEvent>();
  private readonly _addonRemovedSrc = new Subject<string>();
  private readonly _scanUpdateSrc = new BehaviorSubject<ScanUpdate>({ type: ScanUpdateType.Unknown });
  private readonly _installErrorSrc = new Subject<Error>();
  private readonly _syncErrorSrc = new Subject<AddonSyncError>();
  private readonly _scanErrorSrc = new Subject<AddonScanError>();
  private readonly _searchErrorSrc = new Subject<GenericProviderError>();
  private readonly _installQueue = new Subject<InstallQueueItem>();
  private readonly _anyUpdatesAvailableSrc = new BehaviorSubject<boolean>(false);
  private readonly _addonProviderChangeSrc = new Subject<AddonProvider>();
  private readonly _syncingSrc = new BehaviorSubject<boolean>(false);

  private _activeInstalls: AddonUpdateEvent[] = [];
  private _subscriptions: Subscription[] = [];

  public readonly addonAction$ = this._addonActionSrc.asObservable();
  public readonly addonInstalled$ = this._addonInstalledSrc.asObservable();
  public readonly addonRemoved$ = this._addonRemovedSrc.asObservable();
  public readonly scanUpdate$ = this._scanUpdateSrc.asObservable();
  public readonly installError$ = this._installErrorSrc.asObservable();
  public readonly syncError$ = this._syncErrorSrc.asObservable();
  public readonly scanError$ = this._scanErrorSrc.asObservable();
  public readonly searchError$ = this._searchErrorSrc.asObservable();
  public readonly anyUpdatesAvailable$ = this._anyUpdatesAvailableSrc.asObservable();
  public readonly addonProviderChange$ = this._addonProviderChangeSrc.asObservable();
  public readonly syncing$ = this._syncingSrc.asObservable();

  public constructor(
    private _addonStorage: AddonStorageService,
    private _analyticsService: AnalyticsService,
    private _warcraftService: WarcraftService,
    private _wowUpService: WowUpService,
    private _downloadService: DownloadService,
    private _fileService: FileService,
    private _tocService: TocService,
    private _warcraftInstallationService: WarcraftInstallationService,
    private _addonProviderService: AddonProviderFactory,
    private _addonFingerprintService: AddonFingerprintService
  ) {
    // This should keep the current update queue state snapshot up to date
    const addonInstalledSub = this.addonInstalled$
      .pipe(
        tap(() => {
          from(this.areAnyAddonsAvailableForUpdate())
            .pipe(first())
            .subscribe((updatesAvailable) => {
              this._anyUpdatesAvailableSrc.next(updatesAvailable);
            });
        })
      )
      .subscribe(this.updateActiveInstall);

    const addonRemovedSub = this.addonRemoved$
      .pipe(switchMap(() => from(this.areAnyAddonsAvailableForUpdate())))
      .subscribe((updatesAvailable) => {
        this._anyUpdatesAvailableSrc.next(updatesAvailable);
      });

    const addonScanSub = this.scanUpdate$
      .pipe(switchMap(() => from(this.areAnyAddonsAvailableForUpdate())))
      .subscribe((updatesAvailable) => {
        this._anyUpdatesAvailableSrc.next(updatesAvailable);
      });

    // Setup our install queue pump here
    const queueSub = this._installQueue.pipe(mergeMap((item) => from(this.processInstallQueue(item)), 3)).subscribe({
      next: (addonName) => {
        console.log("Install complete", addonName);
      },
      error: (error: Error) => {
        console.error(error);
        this._installErrorSrc.next(error);
      },
    });

    // Attempt to remove addons for clients that were lost
    this._warcraftInstallationService.wowInstallations$
      .pipe(
        filter((installations) => installations.length > 0),
        switchMap((clientTypes) => from(this.reconcileOrphanAddons(clientTypes))),
        catchError((e) => {
          console.error(`reconcileOrphanAddons failed`, e);
          return of(undefined);
        })
      )
      .subscribe();

    // When legacy installation setup is complete, migrate the addons
    this._warcraftInstallationService.legacyInstallationSrc$
      .pipe(
        first(),
        switchMap((installations) => from(this.handleLegacyInstallations(installations)))
      )
      .subscribe(() => console.log(`Legacy installation addons finished`));

    from(this.areAnyAddonsAvailableForUpdate())
      .pipe(first())
      .subscribe((updatesAvailable) => {
        this._anyUpdatesAvailableSrc.next(updatesAvailable);
      });

    this._subscriptions.push(addonInstalledSub, addonRemovedSub, addonScanSub, queueSub);
  }

  public isInstalling(addonId?: string): boolean {
    if (!addonId) {
      return this._activeInstalls.length > 0;
    }
    return this._activeInstalls.find((install) => install.addon.id === addonId) !== undefined;
  }

  public getInstallStatus(addonId: string): AddonUpdateEvent | undefined {
    return this._activeInstalls.find((install) => install.addon.id === addonId);
  }

  public async hasUpdatesAvailable(installation: WowInstallation): Promise<boolean> {
    const addons = await this.getAddons(installation);
    return addons.some((addon) => AddonUtils.needsUpdate(addon));
  }

  private async handleLegacyInstallations(installations: WowInstallation[]): Promise<void> {
    if (installations.length === 0) {
      console.debug(`No legacy installations to migrate`);
      return;
    }

    const allAddons = await this._addonStorage.getAll();

    for (const addon of allAddons) {
      // Legacy addons will not have an installationId
      if (addon.installationId) {
        continue;
      }

      const installation = installations.find((inst) => inst.clientType === addon.clientType);
      if (!installation) {
        continue;
      }

      addon.installationId = installation.id;
      await this.saveAddon(addon);
    }
  }

  public addonMatchesSearchResult(addon1: Addon, addon2: AddonSearchResult): boolean {
    return (
      addon1?.externalId?.toString() === addon2?.externalId?.toString() && addon1.providerName === addon2.providerName
    );
  }

  public async getCategoryPage(category: AddonCategory, installation: WowInstallation): Promise<AddonSearchResult[]> {
    const providers = this._addonProviderService.getEnabledAddonProviders();

    this._analyticsService.trackAction(USER_ACTION_BROWSE_CATEGORY, {
      clientType: getEnumName(WowClientType, installation.clientType),
      category: getEnumName(AddonCategory, category),
    });

    const resultSet: AddonSearchResult[][] = [];
    for (const provider of providers) {
      try {
        const results = await provider.getCategory(category, installation);
        resultSet.push(results);
      } catch (e) {
        console.error(e);
      }
    }

    return _.flatten(resultSet);
  }

  public async getFullDescription(
    installation: WowInstallation,
    providerName: string,
    externalId: string,
    addon?: Addon
  ): Promise<string> {
    const provider = this._addonProviderService.getProvider(providerName);
    if (!provider) {
      return "";
    }

    return await provider.getDescription(installation, externalId, addon);
  }

  public async getChangelogForSearchResult(
    installation: WowInstallation,
    channelType: AddonChannelType,
    searchResult: AddonSearchResult
  ): Promise<string> {
    try {
      const provider = this._addonProviderService.getProvider(searchResult.providerName);
      if (!provider) {
        return "";
      }

      const latestFile = SearchResults.getLatestFile(searchResult, channelType);
      if (!latestFile) {
        throw new Error("Latest file not found");
      }

      return await provider.getChangelog(installation, searchResult.externalId, latestFile.externalId ?? "");
    } catch (e) {
      console.error("Failed to get searchResult changelog", e);
      return "";
    }
  }

  public async getChangelogForAddon(installation: WowInstallation, addon: Addon): Promise<string> {
    if (!addon) {
      return "";
    }

    if (addon.latestChangelog && addon.latestChangelogVersion === addon.latestVersion) {
      return addon.latestChangelog;
    }

    try {
      const provider = this._addonProviderService.getProvider(addon.providerName ?? "");
      if (!provider) {
        return "";
      }

      const changelog = await provider.getChangelog(
        installation,
        addon.externalId ?? "",
        addon.externalLatestReleaseId ?? ""
      );

      return changelog;
    } catch (e) {
      console.error("Failed to get addon changelog", e);
      return "";
    }
  }

  public async saveAddon(addon: Addon | undefined): Promise<void> {
    if (!addon) {
      throw new Error("Invalid addon");
    }

    await this._addonStorage.setAsync(addon.id, addon);
  }

  public async search(query: string, installation: WowInstallation): Promise<AddonSearchResult[]> {
    const addonProviders = this._addonProviderService.getEnabledAddonProviders();
    const searchTasks: Promise<AddonSearchResult[]>[] = addonProviders.map(async (p) => {
      try {
        return await p.searchByQuery(query, installation);
      } catch (e) {
        console.error(`Failed during search: ${p.name}`, e);
        this._searchErrorSrc.next(new GenericProviderError(e as Error, p.name));
        return [];
      }
    });

    const searchResults = await Promise.all(searchTasks);

    this._analyticsService.trackAction(USER_ACTION_ADDON_SEARCH, {
      clientType: getEnumName(WowClientType, installation.clientType),
      query,
    });

    const flatResults = searchResults.flat(1);

    return _.orderBy(flatResults, "downloadCount").reverse();
  }

  public async installBaseAddon(
    externalId: string,
    providerName: string,
    installation: WowInstallation,
    onUpdate: (installState: AddonInstallState, progress: number) => void = () => {},
    targetFile?: AddonSearchResultFile
  ): Promise<Addon | undefined> {
    const existingAddon = await this.getByExternalId(externalId, providerName, installation.id);
    if (existingAddon) {
      throw new Error("Addon already installed");
    }

    const addon = await this.getAddon(externalId, providerName, installation, targetFile).toPromise();

    if (addon?.id !== undefined) {
      await this._addonStorage.setAsync(addon.id, addon);
      await this.installAddon(addon.id, onUpdate);
      return addon;
    }

    return undefined;
  }

  public async installPotentialAddon(
    potentialAddon: AddonSearchResult,
    installation: WowInstallation,
    onUpdate: (installState: AddonInstallState, progress: number) => void = () => {},
    targetFile?: AddonSearchResultFile
  ): Promise<void> {
    const existingAddon = await this.getByExternalId(
      potentialAddon.externalId,
      potentialAddon.providerName,
      installation.id
    );
    if (existingAddon) {
      throw new Error("Addon already installed");
    }

    const latestFile = SearchResults.getLatestFile(potentialAddon, installation.defaultAddonChannelType);
    if (!latestFile) {
      console.warn(`Latest file not found`);
      return undefined;
    }

    const addon = this.createAddon(potentialAddon, targetFile ?? latestFile, installation);

    if (addon?.id !== undefined) {
      await this._addonStorage.setAsync(addon.id, addon);
      await this.installAddon(addon.id, onUpdate);
    }
  }

  public getRequiredDependencies(addon: Addon): AddonDependency[] {
    return Array.isArray(addon.dependencies)
      ? addon.dependencies.filter((dep) => dep.type === AddonDependencyType.Required)
      : [];
  }

  public async getAllAddonsAvailableForUpdate(wowInstallation?: WowInstallation): Promise<Addon[]> {
    return await this._addonStorage.queryAllAsync((addon) => {
      if (typeof wowInstallation === "object" && wowInstallation.id !== addon.installationId) {
        return false;
      }

      return addon.isIgnored !== true && AddonUtils.needsUpdate(addon);
    });
  }

  public async installDependencies(
    addon: Addon,
    onUpdate: (installState: AddonInstallState, progress: number) => void = () => {}
  ): Promise<void> {
    if (!addon.dependencies || !addon.providerName || !addon.installationId) {
      console.warn(`Invalid addon: ${addon.id ?? ""}`);
      return;
    }

    const requiredDependencies = this.getRequiredDependencies(addon);
    if (!requiredDependencies.length) {
      console.log(`${addon.name}: No required dependencies found`);
      return;
    }

    const maxCt = requiredDependencies.length;
    let currentCt = 0;
    for (const dependency of requiredDependencies) {
      currentCt += 1;
      const percent = (currentCt / maxCt) * 100;

      onUpdate?.call(this, AddonInstallState.Installing, percent);

      // If the dependency is already installed, skip it
      const existingAddon = await this.getByExternalId(
        dependency.externalAddonId,
        addon.providerName,
        addon.installationId
      );
      if (existingAddon) {
        continue;
      }

      const installation = this._warcraftInstallationService.getWowInstallation(addon.installationId);
      if (!installation) {
        throw new Error("Installation not found");
      }

      const dependencyAddon = await this.getAddon(
        dependency.externalAddonId,
        addon.providerName,
        installation
      ).toPromise();

      if (!dependencyAddon || !dependencyAddon.id) {
        console.warn(
          `No addon was found EID: ${dependency.externalAddonId} CP: ${addon.providerName ?? ""} CT: ${
            addon.clientType
          }`
        );
        continue;
      }

      await this._addonStorage.setAsync(dependencyAddon.id, dependencyAddon);

      await this.installAddon(dependencyAddon.id);
    }
  }

  public async processAutoUpdates(): Promise<Addon[]> {
    const autoUpdateAddons = await this.getAutoUpdateEnabledAddons();
    const addonsWithUpdates = autoUpdateAddons.filter((addon) => AddonUtils.needsUpdate(addon));

    const tasks = addonsWithUpdates.map((addon) =>
      this.updateAddon(addon.id)
        .then(() => addon)
        .catch((e) => console.error(e))
    );

    const results = await Promise.all(tasks);
    return results.filter((res) => res !== undefined).map((res) => res as Addon);
  }

  public async getAutoUpdateEnabledAddons(): Promise<Addon[]> {
    return await this._addonStorage.queryAllAsync((addon) => {
      return addon.isIgnored !== true && addon.autoUpdateEnabled && !!addon.installationId;
    });
  }

  public async getAllByExternalAddonId(externalAddonIds: string[]): Promise<Addon[]> {
    return await this._addonStorage.queryAllAsync((addon) => {
      return externalAddonIds.includes(addon.externalId);
    });
  }

  public async hasAnyWithExternalAddonIds(externalAddonIds: string[]): Promise<boolean> {
    const addons = await this.getAllByExternalAddonId(externalAddonIds);
    return addons.length > 0;
  }

  public updateAddon(
    addonId: string,
    onUpdate: (installState: AddonInstallState, progress: number) => void = () => {},
    originalAddon: Addon | undefined = undefined
  ): Promise<void> {
    if (!addonId) {
      return Promise.resolve(undefined);
    }

    return this.installOrUpdateAddon(addonId, "update", onUpdate, originalAddon);
  }

  public installAddon(
    addonId: string,
    onUpdate: (installState: AddonInstallState, progress: number) => void = () => {},
    originalAddon: Addon | undefined = undefined
  ): Promise<void> {
    if (!addonId) {
      console.warn("installAddon invalid addon id");
      return Promise.resolve(undefined);
    }

    return this.installOrUpdateAddon(addonId, "install", onUpdate, originalAddon);
  }

  public async installOrUpdateAddon(
    addonId: string,
    installType: InstallType,
    onUpdate: (installState: AddonInstallState, progress: number) => void = () => {},
    originalAddon: Addon | undefined = undefined
  ): Promise<void> {
    const addon = await this.getAddonById(addonId);
    if (addon == null || !addon.downloadUrl) {
      throw new Error(`Addon not found or invalid: ${addonId}`);
    }

    onUpdate?.call(this, AddonInstallState.Pending, 0);
    const updateEvent: AddonUpdateEvent = {
      addon,
      installState: AddonInstallState.Pending,
      progress: 0,
    };
    this._addonInstalledSrc.next(updateEvent);

    // create a ref for resolving or rejecting once the queue grabs this.
    let completion = { resolve: () => {}, reject: () => {} };
    const promise = new Promise<void>((resolve, reject) => {
      completion = { resolve, reject };
    });

    const installQueueItem: InstallQueueItem = {
      addonId,
      onUpdate,
      completion,
      installType,
      originalAddon: originalAddon ? { ...originalAddon } : undefined,
    };
    this._installQueue.next(installQueueItem);

    return promise;
  }

  /**
   * Keep the snapshot of current progress items up to date
   * Remove them when complete or error
   */
  private updateActiveInstall = (updateEvent: AddonUpdateEvent): void => {
    const itemIdx = this._activeInstalls.findIndex((install) => install.addon.id === updateEvent.addon.id);
    if (itemIdx === -1) {
      this._activeInstalls.push(updateEvent);
    }

    if ([AddonInstallState.Complete, AddonInstallState.Error].includes(updateEvent.installState)) {
      _.remove(this._activeInstalls, (install) => install.addon.id === updateEvent.addon.id);
    } else {
      this._activeInstalls.splice(itemIdx, 1, updateEvent);
    }
  };

  private processInstallQueue = async (queueItem: InstallQueueItem): Promise<string> => {
    const addonId = queueItem.addonId;
    const onUpdate = queueItem.onUpdate;

    const addon = await this.getAddonById(addonId);
    if (addon == null || !addon.downloadUrl) {
      throw new Error("Addon not found or invalid");
    }

    this.logAddonAction(
      `Addon${capitalizeString(queueItem.installType)}`,
      addon,
      `'${addon.installedVersion ?? ""}' -> '${addon.latestVersion ?? ""}'`
    );

    const installation = this._warcraftInstallationService.getWowInstallation(addon.installationId);
    if (!installation) {
      throw new Error(`Installation not found: ${addon.installationId ?? ""}`);
    }

    const addonProvider = this._addonProviderService.getProvider(addon.providerName ?? "");
    if (!addonProvider) {
      throw new Error(`Addon provider not found: ${addon.providerName ?? ""}`);
    }

    const downloadFileName = `${slug(addon.name)}.zip`;

    onUpdate?.call(this, AddonInstallState.Downloading, 25);
    this._addonInstalledSrc.next({
      addon,
      installState: AddonInstallState.Downloading,
      progress: 25,
    });

    let downloadedFilePath = "";
    let unzippedDirectory = "";

    try {
      const downloadOptions: DownloadOptions = {
        fileName: downloadFileName,
        outputFolder: this._wowUpService.applicationDownloadsFolderPath,
        url: addon.downloadUrl,
        auth: addonProvider.getDownloadAuth(),
      };

      downloadedFilePath = await this._downloadService.downloadZipFile(downloadOptions);

      onUpdate?.call(this, AddonInstallState.BackingUp, 50);
      this._addonInstalledSrc.next({
        addon,
        installState: AddonInstallState.BackingUp,
        progress: 50,
      });

      const directoriesToBeRemoved = await this.backupOriginalDirectories(addon);

      onUpdate?.call(this, AddonInstallState.Installing, 75);
      this._addonInstalledSrc.next({
        addon,
        installState: AddonInstallState.Installing,
        progress: 75,
      });

      const unzipPath = path.join(this._wowUpService.applicationDownloadsFolderPath, nanoid());

      try {
        unzippedDirectory = await this._fileService.unzipFile(downloadedFilePath, unzipPath);
        await this.installUnzippedDirectory(unzippedDirectory, installation);
      } catch (err) {
        console.error(err);

        this.logAddonAction("RestoreBackup", addon, ...directoriesToBeRemoved);
        await this.restoreAddonDirectories(directoriesToBeRemoved);

        throw err;
      } finally {
        await this._fileService.removeAllSafe(...directoriesToBeRemoved);
      }

      const unzippedDirectoryNames = await this._fileService.listDirectories(unzippedDirectory);
      _.remove(unzippedDirectoryNames, (dirName) => IGNORED_FOLDER_NAMES.includes(dirName));

      const existingDirectoryNames = addon.installedFolderList ?? [];
      const addedDirectoryNames = _.difference(unzippedDirectoryNames, existingDirectoryNames);
      const removedDirectoryNames = _.difference(existingDirectoryNames, unzippedDirectoryNames);

      if (existingDirectoryNames.length > 0) {
        this.logAddonAction("AddedDirs", addon, ...addedDirectoryNames);
      }

      if (removedDirectoryNames.length > 0) {
        this.logAddonAction("DiffDirs", addon, ...removedDirectoryNames);
      }

      addon.installedExternalReleaseId = addon.externalLatestReleaseId;
      addon.installedVersion = addon.latestVersion;
      addon.installedAt = new Date();
      addon.installedFolderList = unzippedDirectoryNames;
      addon.installedFolders = unzippedDirectoryNames.join(",");
      addon.isIgnored = addonProvider.forceIgnore;

      const allTocFiles = await this._tocService.getAllTocs(
        unzippedDirectory,
        unzippedDirectoryNames,
        addon.clientType
      );
      const gameVersion = this.getLatestGameVersion(allTocFiles);
      if (gameVersion) {
        addon.gameVersion = AddonUtils.getGameVersion(gameVersion);
      }

      if (!addon.author) {
        addon.author = this.getBestGuessAuthor(allTocFiles);
      }

      // If this is a zip file addon, try to pull the name out of the toc
      if (addonProvider.name === ADDON_PROVIDER_ZIP) {
        addon.name = this.getBestGuessTitle(allTocFiles);
      }

      await this._addonStorage.setAsync(addon.id, addon);

      this.trackInstallAction(queueItem.installType, addon);

      await this.installDependencies(addon, onUpdate);

      await this.backfillAddon(addon);

      if (queueItem.originalAddon) {
        await this.reconcileExternalIds(addon, queueItem.originalAddon);
      }

      await this.reconcileAddonFolders(addon);

      queueItem.completion.resolve();

      onUpdate?.call(this, AddonInstallState.Complete, 100);
      this._addonInstalledSrc.next({
        addon,
        installState: AddonInstallState.Complete,
        progress: 100,
      });

      this.logAddonAction(
        `Addon${capitalizeString(queueItem.installType)}Complete`,
        addon,
        addon.installedVersion ?? ""
      );
    } catch (err) {
      console.error(err);
      queueItem.completion.reject(err);

      onUpdate?.call(this, AddonInstallState.Error, 100);
      this._addonInstalledSrc.next({
        addon,
        installState: AddonInstallState.Error,
        progress: 100,
      });
    } finally {
      const unzippedDirectoryExists = await this._fileService.pathExists(unzippedDirectory);

      const downloadedFilePathExists = await this._fileService.pathExists(downloadedFilePath);

      if (unzippedDirectoryExists) {
        await this._fileService.remove(unzippedDirectory);
      }

      if (downloadedFilePathExists) {
        await this._fileService.remove(downloadedFilePath);
      }
    }
    return addon.name;
  };

  public async logDebugData(): Promise<void> {
    const hubProvider = this._addonProviderService.getProvider<WowUpAddonProvider>(ADDON_PROVIDER_HUB);

    const clientMap = {};
    const installations = await this._warcraftInstallationService.getWowInstallationsAsync();
    for (const installation of installations) {
      const clientTypeName = getEnumName(WowClientType, installation.clientType);

      const useSymlinkMode = await this._wowUpService.getUseSymlinkMode();
      const addonFolders = await this._warcraftService.listAddons(installation, useSymlinkMode);

      const hubMap = {};
      const hubScanResults = await hubProvider.getScanResults(addonFolders);
      hubScanResults.forEach((sr) => (hubMap[sr.folderName] = sr.fingerprint));

      clientMap[clientTypeName] = {
        hub: hubMap,
      };

      console.log(`clientType ${clientTypeName} addon fingerprints`);
    }

    console.log(JSON.stringify(clientMap));
  }

  private getBestGuessTitle(tocs: Toc[]) {
    const titles = tocs.map((toc) => toc.title).filter((title) => !!title);
    return _.maxBy(titles, (title) => title?.length ?? 0) ?? "";
  }

  private getBestGuessAuthor(tocs: Toc[]) {
    const authors = tocs.map((toc) => toc.author).filter((author) => !!author);
    return _.maxBy(authors, (author) => author?.length ?? 0);
  }

  private getLatestGameVersion(tocs: Toc[]) {
    const versions = tocs.map((toc) => toc.interface);
    return AddonUtils.getGameVersion(_.orderBy(versions, [], "desc")[0] || "");
  }

  private async backupOriginalDirectories(addon: Addon): Promise<string[]> {
    const installedFolders = addon.installedFolderList ?? [];
    const installation = this._warcraftInstallationService.getWowInstallation(addon.installationId);
    if (!installation) {
      return [];
    }

    const addonFolderPath = this._warcraftService.getAddonFolderPath(installation);

    const backupFolders: string[] = [];
    for (const addonFolder of installedFolders) {
      const currentAddonLocation = path.join(addonFolderPath, addonFolder);
      const addonFolderBackupLocation = path.join(addonFolderPath, `${addonFolder}-bak`);

      await this._fileService.deleteIfExists(addonFolderBackupLocation);

      if (await this._fileService.pathExists(currentAddonLocation)) {
        // Create the backup dir first
        await this._fileService.createDirectory(addonFolderBackupLocation);

        // Copy current contents into the new backup dir, doing a rename has other implications so we copy
        await this._fileService.copy(currentAddonLocation, addonFolderBackupLocation);

        // Delete the current version
        await this._fileService.remove(currentAddonLocation);

        backupFolders.push(addonFolderBackupLocation);
      }
    }

    return backupFolders;
  }

  private logAddonAction(action: string, addon: Addon, ...extras: string[]) {
    console.log(
      `[${action}] ${addon.providerName ?? ""} ${addon.externalId ?? "NO_EXT_ID"} ${addon.name} ${extras.join(" ")}`
    );
  }

  private async restoreAddonDirectories(directories: string[]) {
    try {
      for (const directory of directories) {
        const originalLocation = directory.substring(0, directory.length - 4);

        // If a backup directory exists, attempt to roll back
        const dirExists = await this._fileService.pathExists(directory);
        if (dirExists) {
          // If the new addon folder was already created delete it
          const originExists = await this._fileService.pathExists(originalLocation);
          if (originExists) {
            await this._fileService.remove(originalLocation);
          }

          // Move the backup folder into the original location
          await this._fileService.copy(directory, originalLocation);
        }
      }
    } catch (e) {
      console.error(`Failed to roll back directories`, directories, e);
    }
  }

  private async installUnzippedDirectory(unzippedDirectory: string, installation: WowInstallation) {
    const addonFolderPath = this._warcraftService.getAddonFolderPath(installation);
    const unzippedFolders = await this._fileService.listDirectories(unzippedDirectory);
    for (const unzippedFolder of unzippedFolders) {
      if (IGNORED_FOLDER_NAMES.includes(unzippedFolder)) {
        continue;
      }
      const unzippedFilePath = path.join(unzippedDirectory, unzippedFolder);
      const unzipLocation = path.join(addonFolderPath, unzippedFolder);

      try {
        // Copy contents from unzipped new directory to existing addon folder location
        await this._fileService.copy(unzippedFilePath, unzipLocation);
      } catch (err) {
        console.error(`Failed to copy addon directory ${unzipLocation}`);
        throw err;
      }
    }
  }

  public getAddonById(addonId: string): Promise<Addon> {
    return this._addonStorage.get(addonId);
  }

  public async getAddonByUrl(url: URL, installation: WowInstallation): Promise<SearchByUrlResult> {
    const provider = this._addonProviderService.getAddonProviderForUri(url);
    if (!provider) {
      console.warn(`No provider found for url: ${url.toString()}`);
      return undefined;
    }

    return await provider.searchByUrl(url, installation);
  }

  public getAddon(
    externalId: string,
    providerName: string,
    installation: WowInstallation,
    targetFile?: AddonSearchResultFile
  ): Observable<Addon | undefined> {
    const targetAddonChannel = installation.defaultAddonChannelType;
    const provider = this._addonProviderService.getProvider(providerName);
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    return provider.getById(externalId, installation).pipe(
      map((searchResult) => {
        if (!searchResult) {
          console.warn("provider get by id returned nothing");
          return undefined;
        }

        const latestFile = SearchResults.getLatestFile(searchResult, targetAddonChannel);
        if (!latestFile) {
          console.warn(`Latest file not found`);
          return undefined;
        }

        return this.createAddon(searchResult, targetFile ?? latestFile, installation);
      })
    );
  }

  public getInstallBasePath(addon: Addon): string {
    const installation = this._warcraftInstallationService.getWowInstallation(addon.installationId);
    if (!installation) {
      throw new Error(`installation not found: ${addon.installationId ?? ""}`);
    }
    return this._warcraftService.getAddonFolderPath(installation);
  }

  public getFullInstallPath(addon: Addon): string {
    const installation = this._warcraftInstallationService.getWowInstallation(addon.installationId);
    if (!installation) {
      throw new Error(`installation not found: ${addon.installationId ?? ""}`);
    }
    const addonFolderPath = this._warcraftService.getAddonFolderPath(installation);
    return path.join(addonFolderPath, _.first(addon.installedFolderList) ?? "");
  }

  public async removeAddon(
    addon: Addon | undefined,
    removeDependencies = false,
    removeDirectories = true
  ): Promise<void> {
    if (addon === undefined) {
      throw new Error("Invalid addon");
    }

    console.log(`[RemoveAddon] ${addon.providerName ?? ""} ${addon.externalId ?? "NO_EXT_ID"} ${addon.name}`);

    const installedDirectories = addon.installedFolderList ?? [];
    if (removeDirectories && installedDirectories.length > 0) {
      const installation = this._warcraftInstallationService.getWowInstallation(addon.installationId);
      if (!installation) {
        console.warn("No installation found for remove", addon.installationId);
        return;
      }

      const addonFolderPath = this._warcraftService.getAddonFolderPath(installation);

      let failureCt = 0;
      for (const directory of installedDirectories) {
        const addonDirectory = path.join(addonFolderPath, directory);
        console.log(
          `[RemoveAddonDirectory] ${addon.providerName ?? ""} ${addon.externalId ?? "NO_EXT_ID"} ${addonDirectory}`
        );
        try {
          await this._fileService.deleteIfExists(addonDirectory);
        } catch (e) {
          console.error(e);
          failureCt += 1;
        }
      }

      if (failureCt === installedDirectories.length) {
        throw new Error("Failed to remove all directories");
      }
    }

    await this._addonStorage.removeAsync(addon);

    this._addonRemovedSrc.next(addon.id);

    if (removeDependencies) {
      await this.removeDependencies(addon);
    }

    this.trackInstallAction("remove", addon);
  }

  private async removeDependencies(addon: Addon) {
    const dependencies = addon.dependencies ?? [];
    for (const dependency of dependencies) {
      if (!dependency.externalAddonId) {
        console.warn("No external addon id for dependency", dependency);
        continue;
      }

      if (!addon.providerName || !addon.installationId) {
        console.warn("Invalid addon for dependency", addon);
        continue;
      }

      const dependencyAddon = await this.getByExternalId(
        dependency.externalAddonId,
        addon.providerName,
        addon.installationId
      );
      if (!dependencyAddon) {
        console.log(`${addon.name}: Dependency not found ${dependency.externalAddonId}`);
        continue;
      }

      await this.removeAddon(dependencyAddon);
    }
  }

  public async getAllAddons(installation: WowInstallation): Promise<Addon[]> {
    return await this._addonStorage.getAllForInstallationIdAsync(installation.id);
  }

  public async rescanInstallation(installation: WowInstallation): Promise<Addon[]> {
    if (!installation) {
      return [];
    }

    console.debug(`[addon-service] rescanInstallation: ${installation.label}`);
    // Fetch existing installation addons
    let addons = await this._addonStorage.getAllForInstallationIdAsync(installation.id);

    // Collect info on filesystem addons
    const newAddons = await this.scanAddons(installation, addons);

    await this._addonStorage.removeAllForInstallationAsync(installation.id);

    // Map the old installation addon settings to the new ones
    addons = this.updateAddons(addons, newAddons);

    console.debug("addons", addons);
    await this._addonStorage.saveAll(addons);

    this._addonActionSrc.next({ type: "scan" });

    return addons;
  }

  public async getProviderAddons(providerName: string): Promise<Addon[]> {
    if (!providerName) {
      return [];
    }

    return await this._addonStorage.getAllForProviderAsync(providerName);
  }

  public async getAddons(installation: WowInstallation, rescan = false): Promise<Addon[]> {
    if (!installation) {
      return [];
    }

    let addons = await this._addonStorage.getAllForInstallationIdAsync(installation.id);

    if (rescan || addons.length === 0) {
      addons = await this.rescanInstallation(installation);
    }

    return addons;
  }

  public async getAddonForProtocol(protocol: string): Promise<ProtocolSearchResult | undefined> {
    const addonProvider = this.getAddonProviderForProtocol(protocol);
    if (!addonProvider) {
      throw new Error(`No addon provider found for protocol ${protocol}`);
    }

    this._analyticsService.trackAction(USER_ACTION_ADDON_PROTOCOL_SEARCH, {
      protocol,
    });

    return await addonProvider.searchProtocol(protocol);
  }

  private getAddonProviderForProtocol(protocol: string): AddonProvider | undefined {
    return this._addonProviderService.getEnabledAddonProviders().find((provider) => provider.isValidProtocol(protocol));
  }

  /** Iterate over all the installed WoW clients and attempt to check for addon updates */
  public async syncAllClients(): Promise<void> {
    console.debug("syncAllClients");
    this._syncingSrc.next(true);

    const installations = await this._warcraftInstallationService.getWowInstallationsAsync();

    try {
      await this.syncBatchProviders(installations);
      await this.syncStandardProviders(installations);
    } catch (e) {
      console.error(e);
    } finally {
      this._syncingSrc.next(false);
      this._addonActionSrc.next({ type: "sync" });
    }
  }

  /** Check for updates for all addons installed for the give WoW client */
  public async syncClient(installation: WowInstallation): Promise<void> {
    console.debug("syncClient", installation.label);
    await this.syncBatchProviders([installation]);

    try {
      await this.syncStandardProviders([installation]);
    } catch (e) {
      console.error(e);
    }
  }

  /** Transform a list of addons into a list of their external IDs while removing empty or undefined values */
  private getExternalIds(addons: Addon[]): string[] {
    return addons.map((addon) => addon.externalId).filter((externalId) => !!externalId);
  }

  /** Iterate over all batch enabled addon providers and combine all
   * external addon IDs into a single request to each batch enabled provider
   * */
  private async syncBatchProviders(installations: WowInstallation[]) {
    console.debug(`syncBatchProviders`);
    const batchedAddonProviders = this._addonProviderService.getBatchAddonProviders();

    for (const provider of batchedAddonProviders) {
      try {
        // Get a list of all installed addons for this provider across all WoW installs
        const allAddons = await this._addonStorage.getAllForProviderAsync(provider.name);
        if (allAddons.length === 0) {
          continue;
        }

        const batchedAddons = allAddons.filter((addon) => addon.isIgnored === false);

        const addonIds = this.getExternalIds(batchedAddons);
        const searchResults = await provider.getAllBatch(installations, addonIds);

        // Process the errors for each installation
        for (const key of Object.keys(searchResults.errors)) {
          const errors = searchResults.errors[key];
          if (errors.length === 0) {
            continue;
          }

          const installation = installations.find((i) => i.id === key);
          const installationAddons = batchedAddons.filter((addon) => addon.installationId === key);
          await this.handleSyncErrors(installation, errors, provider, installationAddons);
        }

        // Process the update results for each installation
        for (const key of Object.keys(searchResults.installationResults)) {
          const addonSearchResults = searchResults.installationResults[key];
          if (addonSearchResults.length === 0) {
            continue;
          }

          const installation = installations.find((i) => i.id === key);
          const installationAddons = batchedAddons.filter((addon) => addon.installationId === key);
          await this.handleSyncResults(addonSearchResults, installationAddons, installation);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }

  private async syncStandardProviders(installations: WowInstallation[]): Promise<boolean> {
    console.info(`syncStandardProviders`);
    let didSync = true;

    const addonProviders = this._addonProviderService.getStandardAddonProviders();
    for (const provider of addonProviders) {
      for (const installation of installations) {
        // fetch all the addons for this WoW client
        const addons = await this._addonStorage.getAllForInstallationIdAsync(installation.id);
        const validAddons = addons.filter((addon) => addon.isIgnored === false);

        try {
          await this.syncProviderAddons(installation, validAddons, provider);
        } catch (e) {
          console.error(`Failed to sync from provider: ${provider.name}`, e);
          this._syncErrorSrc.next(
            new AddonSyncError({
              providerName: provider.name,
              installationName: installation.label,
              innerError: e,
            })
          );
          didSync = false;
        }
      }
    }

    const updatesAvailable = await this.areAnyAddonsAvailableForUpdate();
    this._anyUpdatesAvailableSrc.next(updatesAvailable);

    return didSync;
  }

  private updateAddons(existingAddons: Addon[], newAddons: Addon[]) {
    for (const newAddon of newAddons) {
      const existingAddon = existingAddons.find(
        (ea) =>
          ea.externalId?.toString() === newAddon.externalId?.toString() && ea.providerName == newAddon.providerName
      );

      if (!existingAddon) {
        continue;
      }

      newAddon.autoUpdateEnabled = existingAddon.autoUpdateEnabled;
      newAddon.isIgnored = existingAddon.isIgnored;
      newAddon.installedAt = existingAddon.installedAt;
      newAddon.channelType = Math.max(existingAddon.channelType, newAddon.channelType);
    }

    return newAddons;
  }

  private async syncProviderAddons(installation: WowInstallation, addons: Addon[], addonProvider: AddonProvider) {
    // console.debug(`syncProviderAddons`, installation.label, addonProvider.name);

    const providerAddonIds = this.getExternalIdsForProvider(addonProvider, addons);
    if (!providerAddonIds.length) {
      return;
    }

    const getAllResult = await addonProvider.getAll(installation, providerAddonIds);
    await this.handleSyncErrors(installation, getAllResult.errors, addonProvider, addons);
    await this.handleSyncResults(getAllResult.searchResults, addons, installation);
  }

  private async handleSyncResults(
    addonSearchResults: AddonSearchResult[],
    addons: Addon[],
    installation: WowInstallation
  ): Promise<void> {
    // console.debug(`handleSyncResults`, installation.label, addonSearchResults);
    for (const result of addonSearchResults) {
      const addon = addons.find((addon) => this.addonMatchesSearchResult(addon, result));
      if (!addon) {
        continue;
      }

      try {
        const latestFile = SearchResults.getLatestFile(result, addon?.channelType);
        if (!latestFile) {
          console.warn(`No latest file found: ${addon.name}, clientType: ${addon.clientType}`);

          addon.warningType = AddonWarningType.NoProviderFiles;
          await this._addonStorage.setAsync(addon.id, addon);

          this._syncErrorSrc.next(
            new AddonSyncError({
              providerName: addon.providerName ?? "",
              installationName: installation.label,
              addonName: addon?.name,
            })
          );
          continue;
        }

        await this.setExternalIdString(addon);

        addon.summary = result.summary;
        addon.thumbnailUrl = result.thumbnailUrl;
        addon.latestChangelog = latestFile?.changelog || addon.latestChangelog;

        if (
          addon.warningType &&
          [AddonWarningType.MissingOnProvider, AddonWarningType.NoProviderFiles].includes(addon.warningType)
        ) {
          addon.warningType = undefined;
        }

        addon.screenshotUrls = result.screenshotUrls;

        // Check for a new download URL
        if (latestFile?.downloadUrl && latestFile.downloadUrl !== addon.downloadUrl) {
          addon.downloadUrl = latestFile.downloadUrl || addon.downloadUrl;
        }

        if (Array.isArray(result.fundingLinks)) {
          addon.fundingLinks = result.fundingLinks;
        }

        // If the release ID hasn't changed we don't really need to update the whole record
        if (!!latestFile?.externalId && latestFile.externalId === addon.externalLatestReleaseId) {
          continue;
        } else if (
          !result ||
          !latestFile ||
          (latestFile.version === addon.latestVersion && latestFile.releaseDate === addon.releasedAt)
        ) {
          // There was nothing new to update to, just update what we need to
          continue;
        }

        addon.latestVersion = latestFile.version;
        addon.releasedAt = latestFile.releaseDate;
        addon.externalLatestReleaseId = latestFile.externalId;
        addon.name = result.name;
        addon.author = result.author;
        addon.externalChannel = getEnumName(AddonChannelType, latestFile.channelType);

        if (latestFile.gameVersion) {
          addon.gameVersion = AddonUtils.getGameVersion(latestFile.gameVersion);
        } else if (addon.gameVersion) {
          addon.gameVersion = AddonUtils.getGameVersion(addon.gameVersion);
        } else {
          console.warn("No game version found", addon);
        }

        addon.externalUrl = result.externalUrl;
      } finally {
        await this._addonStorage.setAsync(addon.id, addon);
      }
    }
  }

  private async handleSyncErrors(
    installation: WowInstallation,
    errors: Error[],
    addonProvider: AddonProvider,
    addons: Addon[]
  ): Promise<void> {
    for (const error of errors) {
      const addonId = (error as any).addonId;
      let addon: Addon | undefined = undefined;
      if (addonId) {
        addon = addons.find((a) => a.externalId === addonId && a.providerName === addonProvider.name);
      }

      if (error instanceof GenericProviderError && addon !== undefined) {
        addon.warningType = error.warningType;
        if (addon.id) {
          await this._addonStorage.setAsync(addon.id, addon);
        }
      }

      this._syncErrorSrc.next(
        new AddonSyncError({
          providerName: addonProvider.name,
          installationName: installation.label,
          innerError: error,
          addonName: addon?.name,
        })
      );
    }
  }

  // Legacy TukUI/ElvUI ids were ints, correct them
  private async setExternalIdString(addon: Addon) {
    if (!addon.id) {
      return;
    }
    if (typeof addon.externalId === "string") {
      return;
    }

    const nonStrId: any = addon.externalId;
    addon.externalId = nonStrId.toString();
    await this._addonStorage.setAsync(addon.id, addon);
  }

  private getExternalIdsForProvider(addonProvider: AddonProvider, addons: Addon[]): string[] {
    return addons
      .filter((addon) => addon.providerName === addonProvider.name)
      .map((f) => f.externalId)
      .filter((id) => !!id);
  }

  private async removeGitFolders(addonFolders: AddonFolder[]) {
    for (const addonFolder of addonFolders) {
      const directories = await this._fileService.listDirectories(addonFolder.path);
      const hasGitFolder = !!directories.find((dir) => dir.toLowerCase() === ".git");
      if (hasGitFolder) {
        addonFolder.ignoreReason = "git_repo";
      }
    }
  }

  /**
   * Determine any addons who have providers with re-scanning disabled then remove any addon folders that match those addons
   * Ex: GitHub addons should remain as they cannot be re-scanned at this time via toc
   */
  private removeNonRescanFolders(addonFolders: AddonFolder[], currentAddons: Addon[]): Addon[] {
    const remainingAddons: Addon[] = [];
    const removedAddonFolders: AddonFolder[] = [];

    for (const currentAddon of currentAddons) {
      const provider = this._addonProviderService.getProvider(currentAddon.providerName);
      if (provider === undefined || provider.allowReScan === true) {
        continue;
      }

      const removed = _.remove(addonFolders, (af) => currentAddon.installedFolderList.includes(af.name));
      removedAddonFolders.push(...removed);

      remainingAddons.push(currentAddon);
    }

    console.log(
      `Removed ${removedAddonFolders.length} NonRescan folders: ${removedAddonFolders.map((af) => af.name).join(", ")}`
    );
    console.log(`Kept ${remainingAddons.length} NonRescan addons: ${remainingAddons.map((ad) => ad.name).join(", ")}`);

    return remainingAddons;
  }

  private async migrateLocalAddons(installation: WowInstallation): Promise<void> {
    const existingAddons = await this.getAllAddons(installation);
    if (!existingAddons.length) {
      console.log(`[MigrateInstall] ${installation.label} no addons found`);
      return;
    }

    const needsMigration = existingAddons.some((addon) => this.needsMigration(addon));
    if (!needsMigration) {
      console.log(`[MigrateInstall] ${installation.label} No addons needed to be migrated`);
      return;
    }

    let migratedCt = 0;
    for (const addon of existingAddons) {
      const didMigrate = await this.migrateLocalAddon(addon);
      if (didMigrate) {
        migratedCt += 1;
      }
    }

    console.log(`[MigrateInstall] Local addons complete: [${migratedCt}] ${installation.label}`);
  }

  public async migrateDeep(installation: WowInstallation): Promise<void> {
    await this.migrateLocalAddons(installation);

    console.log(`[MigrateInstall] ${installation.label}`);
    const existingAddons = await this.getAllAddons(installation);
    if (!existingAddons.length) {
      console.log(`[MigrateInstall] ${installation.label} no addons found`);
      return;
    }

    const needsMigration = existingAddons.some((addon) => this.needsMigration(addon));
    if (!needsMigration) {
      console.log(`[MigrateInstall] ${installation.label} No addons needed to be migrated`);
      return;
    }

    const scannedAddons = await this.scanAddons(installation);
    for (const addon of existingAddons) {
      await this.migrateSyncAddon(addon, scannedAddons);
    }
  }

  private needsMigration(addon: Addon) {
    const provider = this._addonProviderService.getProvider(addon.providerName ?? "");

    const migrationNeeded =
      addon.providerName === ADDON_PROVIDER_HUB_LEGACY ||
      typeof addon.autoUpdateNotificationsEnabled === "undefined" ||
      !addon.installedFolderList ||
      !addon.externalChannel ||
      (provider?.shouldMigrate(addon) ?? false);

    return migrationNeeded;
  }

  private async migrateLocalAddon(addon: Addon): Promise<boolean> {
    let changed = false;
    if (typeof addon.autoUpdateNotificationsEnabled === "undefined") {
      console.log(`[MigrateAddon] '${addon.name}' Updating autoUpdateNotificationsEnabled`);
      addon.autoUpdateNotificationsEnabled = addon.autoUpdateEnabled;
      changed = true;
    }

    if (addon.providerName === ADDON_PROVIDER_HUB_LEGACY) {
      console.log(`[MigrateAddon] '${addon.name}' Updating legacy hub name`);
      addon.providerName = ADDON_PROVIDER_HUB;
      changed = true;
    }

    if (changed) {
      await this.saveAddon(addon);
    }

    return changed;
  }

  private async migrateSyncAddon(addon: Addon, scannedAddons: Addon[]): Promise<void> {
    const scannedAddon = scannedAddons.find(
      (sa) => sa.externalId === addon.externalId && addon.providerName === sa.providerName
    );

    if (!scannedAddon) {
      console.log(`[MigrateAddon] '${addon.name}' No scanned addon found`);
      return;
    }

    addon.installedExternalReleaseId = scannedAddon.externalLatestReleaseId;
    addon.externalChannel = scannedAddon.externalChannel;

    // Fill in any addons where this is missing
    if (!addon.installedFolderList) {
      addon.installedFolderList = scannedAddon.installedFolderList;
    }

    await this.saveAddon(addon);
  }

  public async setInstallationAutoUpdate(installation: WowInstallation): Promise<void> {
    const addons = await this._addonStorage.getAllForInstallationIdAsync(installation.id);
    if (addons.length === 0) {
      console.log(`No addons were found to set auto update: ${installation.location}`);
      return;
    }

    console.log(`Setting ${addons.length} addons to auto update: ${installation.defaultAutoUpdate.toString()}`);

    for (const addon of addons) {
      addon.autoUpdateEnabled = installation.defaultAutoUpdate;
    }

    await this._addonStorage.saveAll(addons);
    console.log(`Auto update set complete`);
  }

  private async scanAddons(installation: WowInstallation, currentAddons?: Addon[]): Promise<Addon[]> {
    const addonList: Addon[] = [];

    if (!installation) {
      return [];
    }

    this._scanUpdateSrc.next({
      type: ScanUpdateType.Start,
    });

    try {
      const defaultAddonChannel = installation.defaultAddonChannelType;

      const useSymlinkMode = await this._wowUpService.getUseSymlinkMode();
      const addonFolders = await this._warcraftService.listAddons(installation, useSymlinkMode);

      if (addonFolders.length === 0) {
        return [];
      }

      await this.removeGitFolders(addonFolders);

      if (Array.isArray(currentAddons)) {
        const skippedAddons = this.removeNonRescanFolders(addonFolders, currentAddons);
        addonList.push(...skippedAddons);
      }

      // Get all the fingerprints we might need
      await this._addonFingerprintService.getFingerprints(addonFolders);

      this._scanUpdateSrc.next({
        type: ScanUpdateType.Update,
        currentCount: 0,
        totalCount: addonFolders.length,
      });

      const enabledProviders = this._addonProviderService.getEnabledAddonProviders();
      for (const provider of enabledProviders) {
        try {
          const validFolders = addonFolders.filter((af) => !af.ignoreReason && !af.matchingAddon && af.tocs.length > 0);

          await provider.scan(installation, defaultAddonChannel, validFolders);
        } catch (e) {
          console.error(e);
          this._scanErrorSrc.next(
            new AddonScanError({
              providerName: provider.name,
              innerError: e,
            })
          );
        }
      }

      const matchedAddonFolders = addonFolders.filter((addonFolder) => !!addonFolder.matchingAddon);
      const matchedAddonFolderNames = matchedAddonFolders.map((mf) => mf.name);

      matchedAddonFolders.forEach((maf) => {
        const targetToc = this._tocService.getTocForGameType2(maf, installation.clientType);

        if (!targetToc.fileName.startsWith(maf.name)) {
          console.warn("TOC NAME MISMATCH", maf.name, targetToc.fileName);
          maf.matchingAddon.warningType = AddonWarningType.TocNameMismatch;
        }

        this.setExternalIds(maf.matchingAddon, targetToc);
      });

      const matchedGroups = _.groupBy(
        matchedAddonFolders,
        (addonFolder) =>
          `${addonFolder.matchingAddon?.providerName ?? ""}${addonFolder.matchingAddon?.externalId ?? ""}`
      );

      console.debug("matchedGroups", matchedGroups);

      for (const value of Object.values(matchedGroups)) {
        const ordered = _.orderBy(value, (v) => v.matchingAddon?.externalIds?.length ?? 0).reverse();
        const first = ordered[0];
        if (first.matchingAddon) {
          addonList.push(first.matchingAddon);
        }
      }

      const unmatchedFolders = addonFolders.filter((af) =>
        this.isAddonFolderUnmatched(matchedAddonFolderNames, af, installation)
      );

      for (const uf of unmatchedFolders) {
        const unmatchedAddon = await this.createUnmatchedAddon(uf, installation, matchedAddonFolderNames);
        addonList.push(unmatchedAddon);
      }

      //Clear the changelogs since they wont always be latest
      addonList.forEach((addon) => {
        if (!addon) {
          return;
        }

        addon.latestChangelog = undefined;
        addon.latestChangelogVersion = undefined;
        addon.channelType = installation.defaultAddonChannelType;
      });

      console.debug(addonList);

      return addonList;
    } finally {
      this._scanUpdateSrc.next({
        type: ScanUpdateType.Complete,
      });
    }
  }

  private setExternalIds(addon: Addon, toc: Toc) {
    if (!toc) {
      return;
    }

    const externalIds: AddonExternalId[] = [];
    for (const [key, value] of Object.entries(ADDON_PROVIDER_TOC_EXTERNAL_ID_MAP)) {
      this.insertExternalId(externalIds, key, toc[value] as string);
    }

    //If the addon does not include the current external id add it
    if (!this.containsOwnExternalId(addon, externalIds)) {
      if (!addon.providerName || !addon.externalId) {
        return;
      }

      this.insertExternalId(externalIds, addon.providerName, addon.externalId);
    }

    addon.externalIds = externalIds;
  }

  private async reconcileAddonFolders(addon: Addon) {
    if (!addon.installationId) {
      console.warn("addon installation id missing", addon);
      return;
    }

    const installation = this._warcraftInstallationService.getWowInstallation(addon.installationId);
    if (!installation) {
      console.warn("addon installation not found", addon.installationId);
      return;
    }

    let existingAddons = await this.getAddons(installation);
    existingAddons = existingAddons.filter(
      (ea) => ea.id !== addon.id && _.intersection(addon.installedFolderList, ea.installedFolderList).length > 0
    );

    for (const existingAddon of existingAddons) {
      if (existingAddon.providerName === ADDON_PROVIDER_UNKNOWN) {
        await this.removeAddon(existingAddon, false, false);
      }
    }
  }

  /**
   * This should verify that a folder that did not have a match, is actually unmatched
   * This will happen for any sub folders of TukUI or WowInterface addons
   */
  private isAddonFolderUnmatched(
    matchedFolderNames: string[],
    addonFolder: AddonFolder,
    installation: WowInstallation
  ) {
    if (addonFolder.matchingAddon) {
      return false;
    }

    const targetToc = this._tocService.getTocForGameType2(addonFolder, installation.clientType);

    // if the folder is load on demand, it 'should' be a sub folder
    const isLoadOnDemand = targetToc?.loadOnDemand === "1";
    if (isLoadOnDemand && this.allItemsMatch(targetToc.dependencyList, matchedFolderNames)) {
      return false;
    }

    return true;
  }

  /** Check if all primitives in subset are in the superset (strings, ints) */
  private allItemsMatch(subset: any[], superset: any[]) {
    return _.difference(subset, superset).length === 0;
  }

  public insertExternalId(externalIds: AddonExternalId[], providerName: string, addonId?: string): void {
    if (!addonId || [ADDON_PROVIDER_RAIDERIO, ADDON_PROVIDER_WOWUP_COMPANION].includes(providerName)) {
      return;
    }

    const exists = externalIds.findIndex((extId) => extId.id === addonId && extId.providerName === providerName) !== -1;

    if (exists) {
      console.debug(`External id exists ${providerName}|${addonId}`);
      return;
    }

    if (this._addonProviderService.getProvider(providerName)?.isValidAddonId(addonId) ?? false) {
      externalIds.push({
        id: addonId,
        providerName: providerName,
      });
    } else {
      console.warn(`Invalid provider id ${providerName}|${addonId}`);
      console.warn(externalIds);
    }
  }

  public async setProvider(
    addon: Addon | undefined,
    externalId: string,
    providerName: string,
    installation: WowInstallation
  ): Promise<void> {
    if (addon === undefined) {
      throw new Error("Invalid addon");
    }

    const provider = this._addonProviderService.getProvider(providerName);
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    const isInstalled = await this.isInstalled(externalId, providerName, installation);
    if (isInstalled) {
      throw new Error(ERROR_ADDON_ALREADY_INSTALLED);
    }

    const externalAddon = await firstValueFrom(this.getAddon(externalId, providerName, installation));
    if (!externalAddon) {
      throw new Error(`External addon not found: ${providerName}|${externalId}`);
    }

    await this.saveAddon(externalAddon);

    if (!externalAddon.id) {
      throw new Error(`External addon had no id`);
    }

    await this.installAddon(externalAddon.id, undefined, addon);
    await this.removeAddon(addon, false, false);
  }

  public async reconcileOrphanAddons(installations: WowInstallation[]): Promise<void> {
    const addons = await this._addonStorage.getAll();

    for (const addon of addons) {
      if (!addon.installationId) {
        console.debug(
          `Removing detached legacy addon [${getEnumName(WowClientType, addon.clientType)}]: ${addon.name}`
        );
        await this.removeAddon(addon, false, false);
        continue;
      }

      const installation = installations.find((installation) => installation.id === addon.installationId);
      if (installation) {
        continue;
      }

      console.debug(`Removing orphaned addon [${getEnumName(WowClientType, addon.clientType)}]: ${addon.name}`);
      await this.removeAddon(addon, false, false);
    }
  }

  private reconcileExternalIds = async (newAddon: Addon, oldAddon: Addon): Promise<void> => {
    if (!newAddon || !oldAddon) {
      return;
    }

    // Ensure all previously existing external ids are brought along during the swap
    // some addons are not always the same between providers ;)
    oldAddon.externalIds?.forEach((oldExtId) => {
      const match = newAddon.externalIds?.find(
        (newExtId) => newExtId.id === oldExtId.id && newExtId.providerName === oldExtId.providerName
      );
      if (match) {
        return;
      }
      console.log(`Reconciling external id: ${oldExtId.providerName}|${oldExtId.id}`);
      newAddon.externalIds?.push({ ...oldExtId });
    });

    // Remove external ids that are not valid that we may have saved previously
    _.remove(
      newAddon.externalIds ?? [],
      (extId) => !this._addonProviderService.getProvider(extId.providerName)?.isValidAddonId(extId.id) ?? false
    );

    await this.saveAddon(newAddon);
  };

  public getFeaturedAddons(installation: WowInstallation): Observable<AddonSearchResult[]> {
    return forkJoin(
      this._addonProviderService.getEnabledAddonProviders().map(async (p) => {
        try {
          return await p.getFeaturedAddons(installation);
        } catch (e) {
          console.error(`Failed to get featured addons: ${p.name}`, e);
          this._searchErrorSrc.next(new GenericProviderError(e as Error, p.name));
          return [];
        }
      })
    ).pipe(
      map((results) => {
        return _.orderBy(results.flat(1), ["downloadCount"]).reverse();
      })
    );
  }

  public async getByExternalId(externalId: string, providerName: string, installationId: string): Promise<Addon> {
    return await this._addonStorage.getByExternalIdAsync(externalId, providerName, installationId);
  }

  public async isInstalled(externalId: string, providerName: string, installation: WowInstallation): Promise<boolean> {
    const addon = await this.getByExternalId(externalId, providerName, installation.id);
    return !!addon;
  }

  // TODO move this to a different service
  public setProviderEnabled(providerName: string, enabled: boolean): void {
    const provider = this._addonProviderService.getProvider(providerName);
    if (provider) {
      provider.enabled = enabled;
    }

    this._addonProviderChangeSrc.next(provider);
  }

  public async backfillAddons(): Promise<void> {
    const installations = await this._warcraftInstallationService.getWowInstallationsAsync();

    for (const installation of installations) {
      const addons = await this._addonStorage.getAllForInstallationIdAsync(installation.id);
      for (const addon of addons) {
        await this.backfillAddon(addon);
        await this.backfillAddonInstalledFolderList(addon);
      }
    }
  }

  private async backfillAddonInstalledFolderList(addon: Addon): Promise<void> {
    if (addon.installedFolderList) {
      return;
    }

    addon.installedFolderList = addon.installedFolders?.split(",") ?? [];
    await this.saveAddon(addon);
  }

  public async backfillAddon(addon: Addon): Promise<void> {
    if (addon.externalIds && this.containsOwnExternalId(addon)) {
      return;
    }

    try {
      const tocPaths = await this.getTocPaths(addon);
      const tocFiles = await Promise.all(tocPaths.map((tocPath) => this._tocService.parse(tocPath)));
      const orderedTocFiles = _.orderBy(tocFiles, ["wowInterfaceId", "loadOnDemand"], ["desc", "asc"]);
      const primaryToc = _.first(orderedTocFiles);
      if (!primaryToc) {
        throw new Error("Could not find primary toc");
      }

      this.setExternalIds(addon, primaryToc);
      await this.saveAddon(addon);
    } catch (e) {
      console.error(e);
    }
  }

  public containsOwnExternalId(addon: Addon, array?: AddonExternalId[]): boolean {
    const arr = array || addon.externalIds;
    const result =
      Array.isArray(arr) && !!arr.find((ext) => ext.id === addon.externalId && ext.providerName === addon.providerName);
    return result;
  }

  public async getTocPaths(addon: Addon): Promise<string[]> {
    if (!addon.installationId) {
      return [];
    }

    const installation = this._warcraftInstallationService.getWowInstallation(addon.installationId);
    if (!installation) {
      return [];
    }

    const addonFolderPath = this._warcraftService.getAddonFolderPath(installation);

    const addonTocs = await this._tocService.getAllTocs(
      addonFolderPath,
      addon.installedFolderList,
      installation.clientType
    );

    const tocPaths = addonTocs.map((toc) => toc.filePath);
    return tocPaths;
  }

  private createAddon(
    searchResult: AddonSearchResult,
    latestFile: AddonSearchResultFile | undefined,
    installation: WowInstallation
  ): Addon | undefined {
    if (!latestFile) {
      return undefined;
    }

    const dependencies = Array.isArray(latestFile.dependencies)
      ? latestFile.dependencies.map(this.createAddonDependency)
      : [];

    const fundingLinks = Array.isArray(searchResult.fundingLinks) ? [...searchResult.fundingLinks] : [];

    console.debug(`Create Addon: `, installation, latestFile);

    return {
      id: uuidv4(),
      name: searchResult.name,
      thumbnailUrl: searchResult.thumbnailUrl,
      latestVersion: latestFile.version,
      clientType: installation.clientType,
      externalId: searchResult.externalId.toString(),
      gameVersion: AddonUtils.getGameVersion(latestFile.gameVersion),
      author: searchResult.author,
      downloadUrl: latestFile.downloadUrl,
      externalUrl: searchResult.externalUrl,
      providerName: searchResult.providerName,
      channelType: installation.defaultAddonChannelType,
      isIgnored: false,
      autoUpdateEnabled: installation.defaultAutoUpdate,
      autoUpdateNotificationsEnabled: installation.defaultAutoUpdate,
      releasedAt: latestFile.releaseDate,
      summary: searchResult.summary,
      screenshotUrls: searchResult.screenshotUrls,
      dependencies,
      externalChannel: getEnumName(AddonChannelType, latestFile.channelType),
      isLoadOnDemand: false,
      externalLatestReleaseId: latestFile.externalId,
      fundingLinks,
      latestChangelog: latestFile.changelog,
      latestChangelogVersion: latestFile.version,
      installationId: installation.id,
      installedFolderList: [],
    };
  }

  private hasValidTocTitle(toc: Toc) {
    return toc?.title && /[a-zA-Z]/g.test(toc.title);
  }

  private async createUnmatchedAddon(
    addonFolder: AddonFolder,
    installation: WowInstallation,
    matchedAddonFolderNames: string[]
  ): Promise<Addon> {
    const targetToc = this._tocService.getTocForGameType2(addonFolder, installation.clientType);
    const tocMissingDependencies = _.difference(targetToc?.dependencyList, matchedAddonFolderNames);
    const lastUpdatedAt = await this._fileService.getLatestDirUpdateTime(addonFolder.path);

    return {
      id: uuidv4(),
      name: this.hasValidTocTitle(targetToc) ? targetToc.title ?? addonFolder.name : addonFolder.name,
      thumbnailUrl: "",
      latestVersion: targetToc?.version || "",
      installedVersion: targetToc?.version || "",
      clientType: installation.clientType,
      externalId: "",
      gameVersion: AddonUtils.getGameVersion(targetToc?.interface) || "",
      author: targetToc?.author || "",
      downloadUrl: "",
      externalUrl: "",
      providerName: ADDON_PROVIDER_UNKNOWN,
      channelType: AddonChannelType.Stable,
      isIgnored: true,
      autoUpdateEnabled: false,
      autoUpdateNotificationsEnabled: false,
      releasedAt: new Date(lastUpdatedAt),
      installedAt: addonFolder.fileStats?.mtime || new Date(),
      installedFolders: addonFolder.name,
      installedFolderList: [addonFolder.name],
      summary: "",
      screenshotUrls: [],
      isLoadOnDemand: targetToc?.loadOnDemand === "1",
      externalChannel: getEnumName(AddonChannelType, AddonChannelType.Stable),
      missingDependencies: tocMissingDependencies,
      ignoreReason: addonFolder.ignoreReason,
      installationId: installation.id,
    };
  }

  private createAddonDependency = (dependency: AddonSearchResultDependency): AddonDependency => {
    return {
      externalAddonId: dependency.externalAddonId,
      type: dependency.type,
    };
  };

  private trackInstallAction(installType: InstallType, addon: Addon) {
    this._analyticsService.trackAction(USER_ACTION_ADDON_INSTALL, {
      clientType: getEnumName(WowClientType, addon.clientType),
      provider: addon.providerName,
      addon: addon.name,
      addonId: addon.externalId,
      installType,
    });
  }

  private async areAnyAddonsAvailableForUpdate(): Promise<boolean> {
    const addons = await this.getAllAddonsAvailableForUpdate();
    return addons.length > 0;
  }
}
