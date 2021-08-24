import * as _ from "lodash";
import { nanoid } from "nanoid";
import * as path from "path";
import { BehaviorSubject, forkJoin, from, Observable, of, Subject, Subscription } from "rxjs";
import { catchError, filter, first, map, mergeMap, switchMap, tap } from "rxjs/operators";
import * as slug from "slug";
import { v4 as uuidv4 } from "uuid";

import { Injectable } from "@angular/core";

import {
  ADDON_PROVIDER_CURSEFORGE,
  ADDON_PROVIDER_HUB,
  ADDON_PROVIDER_HUB_LEGACY,
  ADDON_PROVIDER_RAIDERIO,
  ADDON_PROVIDER_TUKUI,
  ADDON_PROVIDER_UNKNOWN,
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
import { AddonProvider } from "../../addon-providers/addon-provider";
import { CurseAddonProvider } from "../../addon-providers/curse-addon-provider";
import { WowUpAddonProvider } from "../../addon-providers/wowup-addon-provider";
import { AddonScanError, AddonSyncError, GenericProviderError } from "../../errors";
import { AddonFolder } from "../../models/wowup/addon-folder";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { AddonProviderState } from "../../models/wowup/addon-provider-state";
import { AddonSearchResult } from "../../models/wowup/addon-search-result";
import { AddonSearchResultDependency } from "../../models/wowup/addon-search-result-dependency";
import { AddonSearchResultFile } from "../../models/wowup/addon-search-result-file";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { ProtocolSearchResult } from "../../models/wowup/protocol-search-result";
import { Toc } from "../../models/wowup/toc";
import { WowInstallation } from "../../models/wowup/wow-installation";
import * as AddonUtils from "../../utils/addon.utils";
import { getEnumName } from "../../utils/enum.utils";
import * as SearchResults from "../../utils/search-result.utils";
import { capitalizeString } from "../../utils/string.utils";
import { AnalyticsService } from "../analytics/analytics.service";
import { DownloadService } from "../download/download.service";
import { FileService } from "../files/file.service";
import { AddonStorageService } from "../storage/addon-storage.service";
import { TocService } from "../toc/toc.service";
import { WarcraftInstallationService } from "../warcraft/warcraft-installation.service";
import { WarcraftService } from "../warcraft/warcraft.service";
import { WowUpService } from "../wowup/wowup.service";
import { AddonProviderFactory } from "./addon.provider.factory";

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

interface InstallQueueItem {
  addonId: string;
  onUpdate: (installState: AddonInstallState, progress: number) => void | undefined;
  completion: any;
  originalAddon?: Addon;
  installType: InstallType;
}

const IGNORED_FOLDER_NAMES = ["__MACOSX"];

@Injectable({
  providedIn: "root",
})
export class AddonService {
  private readonly _addonProviders: AddonProvider[];
  private readonly _addonInstalledSrc = new Subject<AddonUpdateEvent>();
  private readonly _addonRemovedSrc = new Subject<string>();
  private readonly _scanUpdateSrc = new BehaviorSubject<ScanUpdate>({ type: ScanUpdateType.Unknown });
  private readonly _installErrorSrc = new Subject<Error>();
  private readonly _syncErrorSrc = new Subject<AddonSyncError>();
  private readonly _scanErrorSrc = new Subject<AddonScanError>();
  private readonly _searchErrorSrc = new Subject<GenericProviderError>();
  private readonly _installQueue = new Subject<InstallQueueItem>();
  private readonly _anyUpdatesAvailableSrc = new BehaviorSubject<boolean>(false);

  private _activeInstalls: AddonUpdateEvent[] = [];
  private _subscriptions: Subscription[] = [];

  public readonly addonInstalled$ = this._addonInstalledSrc.asObservable();
  public readonly addonRemoved$ = this._addonRemovedSrc.asObservable();
  public readonly scanUpdate$ = this._scanUpdateSrc.asObservable();
  public readonly installError$ = this._installErrorSrc.asObservable();
  public readonly syncError$ = this._syncErrorSrc.asObservable();
  public readonly scanError$ = this._scanErrorSrc.asObservable();
  public readonly searchError$ = this._searchErrorSrc.asObservable();
  public readonly anyUpdatesAvailable$ = this._anyUpdatesAvailableSrc.asObservable();

  public constructor(
    private _addonStorage: AddonStorageService,
    private _analyticsService: AnalyticsService,
    private _warcraftService: WarcraftService,
    private _wowUpService: WowUpService,
    private _downloadService: DownloadService,
    private _fileService: FileService,
    private _tocService: TocService,
    private _warcraftInstallationService: WarcraftInstallationService,
    addonProviderFactory: AddonProviderFactory
  ) {
    // Create our base set of addon providers
    this._addonProviders = addonProviderFactory.getProviders();

    // This should keep the current update queue state snapshot up to date
    const addonInstalledSub = this.addonInstalled$
      .pipe(
        tap(() => {
          this._anyUpdatesAvailableSrc.next(this.areAnyAddonsAvailableForUpdate());
        })
      )
      .subscribe(this.updateActiveInstall);

    const addonRemovedSub = this.addonRemoved$
      .pipe(
        tap(() => {
          this._anyUpdatesAvailableSrc.next(this.areAnyAddonsAvailableForUpdate());
        })
      )
      .subscribe();

    const addonScanSub = this.scanUpdate$
      .pipe(
        tap(() => {
          this._anyUpdatesAvailableSrc.next(this.areAnyAddonsAvailableForUpdate());
        })
      )
      .subscribe();

    // Setup our install queue pump here
    const queueSub = this._installQueue.pipe(mergeMap((item) => from(this.processInstallQueue(item)), 3)).subscribe({
      next: (addonName) => {
        console.log("Install complete", addonName);
      },
      error: (error) => {
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
        map((installations) => this.handleLegacyInstallations(installations))
      )
      .subscribe(() => console.log(`Legacy installation addons finished`));

    this._anyUpdatesAvailableSrc.next(this.areAnyAddonsAvailableForUpdate());

    this._subscriptions.push(addonInstalledSub, addonRemovedSub, addonScanSub, queueSub);
  }

  public isInstalling(addonId?: string): boolean {
    if (!addonId) {
      return this._activeInstalls.length > 0;
    }
    return _.find(this._activeInstalls, (install) => install.addon.id === addonId) !== undefined;
  }

  public getInstallStatus(addonId: string): AddonUpdateEvent | undefined {
    return _.find(this._activeInstalls, (install) => install.addon.id === addonId);
  }

  public async hasUpdatesAvailable(installation: WowInstallation): Promise<boolean> {
    const addons = await this.getAddons(installation);
    return _.some(addons, (addon) => AddonUtils.needsUpdate(addon));
  }

  private handleLegacyInstallations(installations: WowInstallation[]): void {
    if (installations.length === 0) {
      console.debug(`No legacy installations to migrate`);
      return;
    }

    const allAddons = this._addonStorage.getAll();

    for (const addon of allAddons) {
      // Legacy addons will not have an installationId
      if (addon.installationId) {
        continue;
      }

      const installation = _.find(installations, (inst) => inst.clientType === addon.clientType);
      if (!installation) {
        continue;
      }

      addon.installationId = installation.id;
      this.saveAddon(addon);
    }
  }

  public canShowChangelog(providerName: string | undefined): boolean {
    return this.getProvider(providerName ?? "")?.canShowChangelog ?? false;
  }

  public canShowAddonChangelog(addon: Addon): boolean {
    return this.canShowChangelog(addon.providerName);
  }

  public isSameAddon(addon1: Addon, addon2: Addon): boolean {
    return addon1.externalId === addon2.externalId && addon1.providerName === addon2.providerName;
  }

  public async getCategoryPage(category: AddonCategory, installation: WowInstallation): Promise<AddonSearchResult[]> {
    const providers = this.getEnabledAddonProviders();

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
    const provider = this.getProvider(providerName);
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
      const provider = this.getProvider(searchResult.providerName);
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
      const provider = this.getProvider(addon.providerName ?? "");
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

  public isForceIgnore(addon: Addon): boolean {
    if (!addon.providerName) {
      return false;
    }

    return (
      addon.providerName === ADDON_PROVIDER_UNKNOWN || (this.getProvider(addon.providerName)?.forceIgnore ?? false)
    );
  }

  public canReinstall(addon: Addon): boolean {
    if (!addon.providerName) {
      return false;
    }

    return (
      addon.providerName !== ADDON_PROVIDER_UNKNOWN && (this.getProvider(addon.providerName)?.allowReinstall ?? false)
    );
  }

  public canChangeChannel(addon: Addon): boolean {
    if (!addon.providerName) {
      return false;
    }

    return (
      addon.providerName !== ADDON_PROVIDER_UNKNOWN &&
      (this.getProvider(addon.providerName)?.allowChannelChange ?? false)
    );
  }

  public getAddonProviderStates(): AddonProviderState[] {
    return _.map(this._addonProviders, (provider) => {
      return {
        providerName: provider.name,
        enabled: provider.enabled,
        canEdit: provider.allowEdit,
      };
    });
  }

  public saveAddon(addon: Addon | undefined): void {
    if (!addon) {
      throw new Error("Invalid addon");
    }

    this._addonStorage.set(addon.id, addon);
  }

  public async search(query: string, installation: WowInstallation): Promise<AddonSearchResult[]> {
    const searchTasks: Promise<AddonSearchResult[]>[] = this.getEnabledAddonProviders().map(async (p) => {
      try {
        return await p.searchByQuery(query, installation);
      } catch (e) {
        console.error(`Failed during search: ${p.name}`, e);
        this._searchErrorSrc.next(new GenericProviderError(e, p.name));
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

  public async installPotentialAddon(
    potentialAddon: AddonSearchResult,
    installation: WowInstallation,
    onUpdate: (installState: AddonInstallState, progress: number) => void = () => {},
    targetFile?: AddonSearchResultFile
  ): Promise<void> {
    const existingAddon = this._addonStorage.getByExternalId(
      potentialAddon.externalId,
      potentialAddon.providerName,
      installation.id
    );
    if (existingAddon) {
      throw new Error("Addon already installed");
    }

    const addon = await this.getAddon(
      potentialAddon.externalId,
      potentialAddon.providerName,
      installation,
      targetFile
    ).toPromise();

    if (addon?.id !== undefined) {
      await this._addonStorage.setAsync(addon.id, addon);
      await this.installAddon(addon.id, onUpdate);
    }
  }

  public getRequiredDependencies(addon: Addon): AddonDependency[] {
    return _.filter(addon.dependencies, (dep) => dep.type === AddonDependencyType.Required);
  }

  public getAllAddonsAvailableForUpdate(): Addon[] {
    return this._addonStorage.queryAll((addon) => {
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
      const existingAddon = this._addonStorage.getByExternalId(
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
    const autoUpdateAddons = this.getAutoUpdateEnabledAddons();
    const addonsWithUpdates = autoUpdateAddons.filter((addon) => AddonUtils.needsUpdate(addon));

    const tasks = addonsWithUpdates.map((addon) =>
      this.updateAddon(addon.id)
        .then(() => addon)
        .catch((e) => console.error(e))
    );

    const results = await Promise.all(tasks);
    return results.filter((res) => res !== undefined).map((res) => res as Addon);
  }

  public getAutoUpdateEnabledAddons(): Addon[] {
    return this._addonStorage.queryAll((addon) => {
      return addon.isIgnored !== true && addon.autoUpdateEnabled && !!addon.installationId;
    });
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
      throw new Error("Addon not found or invalid");
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
    const itemIdx = _.findIndex(this._activeInstalls, (install) => install.addon.id === updateEvent.addon.id);
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

    const addonProvider = this.getProvider(addon.providerName ?? "");
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
      downloadedFilePath = await this._downloadService.downloadZipFile(
        addon.downloadUrl,
        downloadFileName,
        this._wowUpService.applicationDownloadsFolderPath
      );

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
      _.remove(unzippedDirectoryNames, (dirName) => _.includes(IGNORED_FOLDER_NAMES, dirName));

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
        this.reconcileExternalIds(addon, queueItem.originalAddon);
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

  public isValidProviderName(providerName: string): boolean {
    const providerNames = this._addonProviders.map((provider) => provider.name);
    return _.includes(providerNames, providerName);
  }

  public async logDebugData(): Promise<void> {
    const curseProvider: CurseAddonProvider = this._addonProviders.find(
      (p) => p.name === ADDON_PROVIDER_CURSEFORGE
    ) as any;
    const hubProvider: WowUpAddonProvider = this._addonProviders.find((p) => p.name === ADDON_PROVIDER_HUB) as any;

    const clientMap = {};
    const installations = this._warcraftInstallationService.getWowInstallations();
    for (const installation of installations) {
      const clientTypeName = getEnumName(WowClientType, installation.clientType);
      const addonFolders = await this._warcraftService.listAddons(installation, this._wowUpService.useSymlinkMode);

      const curseMap = {};
      const curseScanResults = await curseProvider.getScanResults(addonFolders);
      curseScanResults.forEach((sr) => (curseMap[sr.folderName] = sr.fingerprint));

      const hubMap = {};
      const hubScanResults = await hubProvider.getScanResults(addonFolders);
      hubScanResults.forEach((sr) => (hubMap[sr.folderName] = sr.fingerprint));

      clientMap[clientTypeName] = {
        curse: curseMap,
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
    const versions = _.map(tocs, (toc) => toc.interface);
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

  public async getAddonByUrl(url: URL, installation: WowInstallation): Promise<AddonSearchResult | undefined> {
    const provider = this.getAddonProvider(url);
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
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    return provider.getById(externalId, installation).pipe(
      map((searchResult) => {
        if (!searchResult) {
          return undefined;
        }

        const latestFile = SearchResults.getLatestFile(searchResult, targetAddonChannel);
        if (!latestFile) {
          console.warn(`Latest file not found`);
          return undefined;
        }

        const newAddon = this.createAddon(latestFile.folders[0], searchResult, targetFile ?? latestFile, installation);
        return newAddon;
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

    if (removeDirectories) {
      const installedDirectories = addon.installedFolderList ?? [];
      const installation = this._warcraftInstallationService.getWowInstallation(addon.installationId);
      if (!installation) {
        console.warn("No installation found for remove", addon.installationId);
        return;
      }

      const addonFolderPath = this._warcraftService.getAddonFolderPath(installation);

      for (const directory of installedDirectories) {
        const addonDirectory = path.join(addonFolderPath, directory);
        console.log(
          `[RemoveAddonDirectory] ${addon.providerName ?? ""} ${addon.externalId ?? "NO_EXT_ID"} ${addonDirectory}`
        );
        await this._fileService.remove(addonDirectory);
      }
    }

    this._addonStorage.remove(addon);
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

      const dependencyAddon = this.getByExternalId(
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

  public getAllAddons(installation: WowInstallation): Addon[] {
    return this._addonStorage.getAllForInstallationId(installation.id);
  }

  public async rescanInstallation(installation: WowInstallation): Promise<Addon[]> {
    if (!installation) {
      return [];
    }

    // Fetch existing installation addons
    let addons = this._addonStorage.getAllForInstallationId(installation.id);

    // Collect info on filesystem addons
    const newAddons = await this.scanAddons(installation);

    this._addonStorage.removeAllForInstallation(installation.id);

    // Map the old installation addon settings to the new ones
    addons = this.updateAddons(addons, newAddons);

    await this._addonStorage.saveAll(addons);

    return addons;
  }

  public async getAddons(installation: WowInstallation, rescan = false): Promise<Addon[]> {
    if (!installation) {
      return [];
    }

    let addons = this._addonStorage.getAllForInstallationId(installation.id);

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
    return _.find(this.getEnabledAddonProviders(), (provider) => provider.isValidProtocol(protocol));
  }

  private getBatchAddonProviders(): AddonProvider[] {
    return this._addonProviders.filter((provider) => provider.enabled && provider.canBatchFetch);
  }

  private getStandardAddonProviders(): AddonProvider[] {
    return this._addonProviders.filter((provider) => provider.enabled && !provider.canBatchFetch);
  }

  /** Iterate over all the installed WoW clients and attempt to check for addon updates */
  public async syncAllClients(): Promise<void> {
    const installations = this._warcraftInstallationService.getWowInstallations();

    await this.syncBatchProviders(installations);

    for (const installation of installations) {
      try {
        await this.syncStandardProviders(installation);
      } catch (e) {
        console.error(e);
      }
    }
  }

  /** Check for updates for all addons installed for the give WoW client */
  public async syncClient(installation: WowInstallation): Promise<void> {
    await this.syncBatchProviders([installation]);

    try {
      await this.syncStandardProviders(installation);
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
    const batchedAddonProviders = this.getBatchAddonProviders();

    for (const provider of batchedAddonProviders) {
      // Get a list of all installed addons for this provider across all WoW installs
      const batchedAddons = this._addonStorage
        .getAllForProvider(provider.name)
        .filter((addon) => addon.isIgnored === false);

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
        this.handleSyncErrors(installation, errors, provider, installationAddons);
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
    }
  }

  public async syncStandardProviders(installation: WowInstallation): Promise<boolean> {
    console.info(`syncAddons ${installation.label}`);
    let didSync = true;

    // fetch all the addons for this WoW client
    const addons = this._addonStorage.getAllForInstallationId(installation.id);
    const validAddons = _.filter(addons, (addon) => addon.isIgnored === false);

    const addonProviders = this.getStandardAddonProviders();
    for (const provider of addonProviders) {
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

    this._anyUpdatesAvailableSrc.next(this.areAnyAddonsAvailableForUpdate());

    return didSync;
  }

  private updateAddons(existingAddons: Addon[], newAddons: Addon[]) {
    _.forEach(newAddons, (newAddon) => {
      const existingAddon = _.find(
        existingAddons,
        (ea) =>
          ea.externalId?.toString() === newAddon.externalId?.toString() && ea.providerName == newAddon.providerName
      );

      if (!existingAddon) {
        return;
      }

      newAddon.autoUpdateEnabled = existingAddon.autoUpdateEnabled;
      newAddon.isIgnored = existingAddon.isIgnored;
      newAddon.installedAt = existingAddon.installedAt;
      newAddon.channelType = existingAddon.channelType;
    });

    return newAddons;
  }

  private async syncProviderAddons(installation: WowInstallation, addons: Addon[], addonProvider: AddonProvider) {
    const providerAddonIds = this.getExternalIdsForProvider(addonProvider, addons);
    if (!providerAddonIds.length) {
      return;
    }

    const getAllResult = await addonProvider.getAll(installation, providerAddonIds);
    this.handleSyncErrors(installation, getAllResult.errors, addonProvider, addons);
    await this.handleSyncResults(getAllResult.searchResults, addons, installation);
  }

  private async handleSyncResults(
    addonSearchResults: AddonSearchResult[],
    addons: Addon[],
    installation: WowInstallation
  ): Promise<void> {
    for (const result of addonSearchResults) {
      const addon = addons.find((addon) => addon.externalId?.toString() === result?.externalId?.toString());
      if (!addon) {
        continue;
      }

      try {
        const latestFile = SearchResults.getLatestFile(result, addon?.channelType);
        if (!latestFile) {
          console.warn(`No latest file found: ${addon.name}, clientType: ${addon.clientType}`);

          addon.warningType = AddonWarningType.NoProviderFiles;
          this._addonStorage.set(addon.id, addon);

          this._syncErrorSrc.next(
            new AddonSyncError({
              providerName: addon.providerName ?? "",
              installationName: installation.label,
              addonName: addon?.name,
            })
          );
          continue;
        }

        this.setExternalIdString(addon);

        addon.summary = result.summary;
        addon.thumbnailUrl = result.thumbnailUrl;
        addon.latestChangelog = latestFile?.changelog || addon.latestChangelog;
        addon.warningType = undefined;
        addon.screenshotUrls = result.screenshotUrls;

        // Check for a new download URL
        if (latestFile?.downloadUrl && latestFile.downloadUrl !== addon.downloadUrl) {
          addon.downloadUrl = latestFile.downloadUrl || addon.downloadUrl;
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

  private handleSyncErrors(
    installation: WowInstallation,
    errors: Error[],
    addonProvider: AddonProvider,
    addons: Addon[]
  ) {
    for (const error of errors) {
      const addonId = (error as any).addonId;
      let addon: Addon | undefined = undefined;
      if (addonId) {
        addon = _.find(addons, (a) => a.externalId === addonId);
      }

      if (error instanceof GenericProviderError && addon !== undefined) {
        addon.warningType = error.warningType;
        if (addon.id) {
          this._addonStorage.set(addon.id, addon);
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
  private setExternalIdString(addon: Addon) {
    if (!addon.id) {
      return;
    }
    if (typeof addon.externalId === "string") {
      return;
    }

    const nonStrId: any = addon.externalId;
    addon.externalId = nonStrId.toString();
    this._addonStorage.set(addon.id, addon);
  }

  private getExternalIdsForProvider(addonProvider: AddonProvider, addons: Addon[]): string[] {
    const filtered = addons.filter((addon) => addon.providerName === addonProvider.name);

    const externalIds: string[] = [];
    for (const addon of filtered) {
      if (!addon.externalId) {
        continue;
      }

      externalIds.push(addon.externalId);
    }
    return externalIds;
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

  public async migrate(installation: WowInstallation): Promise<void> {
    console.log(`[MigrateInstall] ${installation.label}`);
    const existingAddons = this.getAllAddons(installation);
    if (!existingAddons.length) {
      console.log(`[MigrateInstall] ${installation.label} no addons found`);
      return;
    }

    const needsMigration = _.some(existingAddons, (addon) => this.needsMigration(addon));
    if (!needsMigration) {
      console.log(`[MigrateInstall] ${installation.label} No addons needed to be migrated`);
      return;
    }

    const scannedAddons = await this.scanAddons(installation);
    for (const addon of existingAddons) {
      this.migrateAddon(addon, scannedAddons);
    }
  }

  private needsMigration(addon: Addon) {
    const provider = this.getProvider(addon.providerName ?? "");

    const migrationNeeded =
      addon.providerName === ADDON_PROVIDER_HUB_LEGACY ||
      !addon.installedFolderList ||
      !addon.externalChannel ||
      (provider?.shouldMigrate(addon) ?? false);

    return migrationNeeded;
  }

  private migrateAddon(addon: Addon, scannedAddons: Addon[]): void {
    if (addon.providerName === ADDON_PROVIDER_HUB_LEGACY) {
      console.log(`[MigrateAddon] '${addon.name}' Updating legacy hub name`);
      addon.providerName = ADDON_PROVIDER_HUB;
      this.saveAddon(addon);
    }

    const scannedAddon = _.find(
      scannedAddons,
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

    this.saveAddon(addon);
  }

  public async setInstallationAutoUpdate(installation: WowInstallation): Promise<void> {
    const addons = this._addonStorage.getAllForInstallationId(installation.id);
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

  private async scanAddons(installation: WowInstallation): Promise<Addon[]> {
    if (!installation) {
      return [];
    }

    this._scanUpdateSrc.next({
      type: ScanUpdateType.Start,
    });

    try {
      const defaultAddonChannel = installation.defaultAddonChannelType;
      const addonFolders = await this._warcraftService.listAddons(installation, this._wowUpService.useSymlinkMode);

      await this.removeGitFolders(addonFolders);

      this._scanUpdateSrc.next({
        type: ScanUpdateType.Update,
        currentCount: 0,
        totalCount: addonFolders.length,
      });

      for (const provider of this.getEnabledAddonProviders()) {
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
        if (maf.matchingAddon) {
          const targetToc = this._tocService.getTocForGameType2(maf, installation.clientType);
          this.setExternalIds(maf.matchingAddon, targetToc);
        }
      });

      const matchedGroups = _.groupBy(
        matchedAddonFolders,
        (addonFolder) =>
          `${addonFolder.matchingAddon?.providerName ?? ""}${addonFolder.matchingAddon?.externalId ?? ""}`
      );

      console.debug("matchedGroups", matchedGroups);

      const addonList: Addon[] = [];
      for (const value of Object.values(matchedGroups)) {
        const ordered = _.orderBy(value, (v) => v.matchingAddon?.externalIds?.length ?? 0).reverse();
        const first = ordered[0];
        if (first.matchingAddon) {
          addonList.push(first.matchingAddon);
        }
      }
      // const addonList = Object.values(matchedGroups).map(
      //   (value) => _.orderBy(value, (v) => v.matchingAddon?.externalIds?.length ?? 0).reverse()[0].matchingAddon
      // );

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
      });

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
    this.insertExternalId(externalIds, ADDON_PROVIDER_WOWINTERFACE, toc.wowInterfaceId);
    this.insertExternalId(externalIds, ADDON_PROVIDER_TUKUI, toc.tukUiProjectId);
    this.insertExternalId(externalIds, ADDON_PROVIDER_CURSEFORGE, toc.curseProjectId);

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
    existingAddons = _.filter(
      existingAddons,
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

    const exists =
      _.findIndex(externalIds, (extId) => extId.id === addonId && extId.providerName === providerName) !== -1;

    if (exists) {
      console.debug(`External id exists ${providerName}|${addonId}`);
      return;
    }

    if (this.getProvider(providerName)?.isValidAddonId(addonId) ?? false) {
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

    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    if (this.isInstalled(externalId, providerName, installation)) {
      throw new Error(ERROR_ADDON_ALREADY_INSTALLED);
    }

    const externalAddon = await this.getAddon(externalId, providerName, installation).toPromise();
    if (!externalAddon) {
      throw new Error(`External addon not found: ${providerName}|${externalId}`);
    }

    this.saveAddon(externalAddon);

    if (!externalAddon.id) {
      throw new Error(`External addon had no id`);
    }

    await this.installAddon(externalAddon.id, undefined, addon);
    await this.removeAddon(addon, false, false);
  }

  public async reconcileOrphanAddons(installations: WowInstallation[]): Promise<void> {
    const addons = [...this._addonStorage.getAll()];

    for (const addon of addons) {
      if (!addon.installationId) {
        console.debug(
          `Removing detached legacy addon [${getEnumName(WowClientType, addon.clientType)}]: ${addon.name}`
        );
        await this.removeAddon(addon, false, false);
        continue;
      }

      const installation = _.find(installations, (installation) => installation.id === addon.installationId);
      if (installation) {
        continue;
      }

      console.debug(`Removing orphaned addon [${getEnumName(WowClientType, addon.clientType)}]: ${addon.name}`);
      await this.removeAddon(addon, false, false);
    }
  }

  public reconcileExternalIds = (newAddon: Addon, oldAddon: Addon): void => {
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
      (extId) => !this.getProvider(extId.providerName)?.isValidAddonId(extId.id) ?? false
    );

    this.saveAddon(newAddon);
  };

  public getFeaturedAddons(installation: WowInstallation): Observable<AddonSearchResult[]> {
    return forkJoin(
      this.getEnabledAddonProviders().map(async (p) => {
        try {
          return await p.getFeaturedAddons(installation);
        } catch (e) {
          console.error(`Failed to get featured addons: ${p.name}`, e);
          this._searchErrorSrc.next(new GenericProviderError(e, p.name));
          return [];
        }
      })
    ).pipe(
      map((results) => {
        return _.orderBy(results.flat(1), ["downloadCount"]).reverse();
      })
    );
  }

  public getByExternalId(externalId: string, providerName: string, installationId: string): Addon {
    return this._addonStorage.getByExternalId(externalId, providerName, installationId);
  }

  public isInstalled(externalId: string, providerName: string, installation: WowInstallation): boolean {
    return !!this.getByExternalId(externalId, providerName, installation.id);
  }

  public setProviderEnabled(providerName: string, enabled: boolean): void {
    const provider = this.getProvider(providerName);
    if (provider) {
      provider.enabled = enabled;
    }
  }

  private getProvider(providerName: string): AddonProvider | undefined {
    return this._addonProviders.find((provider) => provider.name === providerName);
  }

  public async backfillAddons(): Promise<void> {
    const installations = this._warcraftInstallationService.getWowInstallations();

    for (const installation of installations) {
      const addons = this._addonStorage.getAllForInstallationId(installation.id);
      for (const addon of addons) {
        await this.backfillAddon(addon);
        this.backfillAddonInstalledFolderList(addon);
      }
    }
  }

  private backfillAddonInstalledFolderList(addon: Addon): void {
    if (addon.installedFolderList) {
      return;
    }

    addon.installedFolderList = addon.installedFolders?.split(",") ?? [];
    this.saveAddon(addon);
  }

  public async backfillAddon(addon: Addon): Promise<void> {
    if (addon.externalIds && this.containsOwnExternalId(addon)) {
      return;
    }

    try {
      const tocPaths = this.getTocPaths(addon);
      const tocFiles = await Promise.all(_.map(tocPaths, (tocPath) => this._tocService.parse(tocPath)));
      const orderedTocFiles = _.orderBy(tocFiles, ["wowInterfaceId", "loadOnDemand"], ["desc", "asc"]);
      const primaryToc = _.first(orderedTocFiles);
      if (!primaryToc) {
        throw new Error("Could not find primary toc");
      }

      this.setExternalIds(addon, primaryToc);
      this.saveAddon(addon);
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

  public getTocPaths(addon: Addon): string[] {
    if (!addon.installationId) {
      return [];
    }

    const installation = this._warcraftInstallationService.getWowInstallation(addon.installationId);
    if (!installation) {
      return [];
    }

    const addonFolderPath = this._warcraftService.getAddonFolderPath(installation);

    return _.map(addon.installedFolderList, (installedFolder) =>
      path.join(addonFolderPath, installedFolder, `${installedFolder}.toc`)
    );
  }

  private getAddonProvider(addonUri: URL): AddonProvider | undefined {
    return this.getEnabledAddonProviders().find((provider) => provider.isValidAddonUri(addonUri));
  }

  private createAddon(
    folderName: string,
    searchResult: AddonSearchResult,
    latestFile: AddonSearchResultFile | undefined,
    installation: WowInstallation
  ): Addon | undefined {
    if (!latestFile) {
      return undefined;
    }

    const dependencies = _.map(latestFile.dependencies, this.createAddonDependency);
    const fundingLinks = Array.isArray(searchResult.fundingLinks) ? [...searchResult.fundingLinks] : [];

    console.debug(`Create Addon: `, installation);

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

  public getEnabledAddonProviders(): AddonProvider[] {
    return _.filter(this._addonProviders, (provider) => provider.enabled);
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

  private areAnyAddonsAvailableForUpdate(): boolean {
    return this.getAllAddonsAvailableForUpdate().length > 0;
  }
}
