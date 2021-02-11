import * as _ from "lodash";
import * as path from "path";
import { BehaviorSubject, forkJoin, from, Observable, Subject } from "rxjs";
import { filter, map, mergeMap, switchMap } from "rxjs/operators";
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
  ADDON_PROVIDER_ZIP,
  ERROR_ADDON_ALREADY_INSTALLED,
} from "../../../common/constants";
import { AddonProvider } from "../../addon-providers/addon-provider";
import { CurseAddonProvider } from "../../addon-providers/curse-addon-provider";
import { WowUpAddonProvider } from "../../addon-providers/wowup-addon-provider";
import { Addon, AddonExternalId } from "../../entities/addon";
import { AddonScanError, AddonSyncError } from "../../errors";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { AddonChannelType } from "../../models/wowup/addon-channel-type";
import { AddonDependency } from "../../models/wowup/addon-dependency";
import { AddonDependencyType } from "../../models/wowup/addon-dependency-type";
import { AddonFolder } from "../../models/wowup/addon-folder";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { AddonProviderState } from "../../models/wowup/addon-provider-state";
import { AddonSearchResult } from "../../models/wowup/addon-search-result";
import { AddonSearchResultDependency } from "../../models/wowup/addon-search-result-dependency";
import { AddonSearchResultFile } from "../../models/wowup/addon-search-result-file";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { Toc } from "../../models/wowup/toc";
import * as AddonUtils from "../../utils/addon.utils";
import { getEnumName } from "../../utils/enum.utils";
import { AnalyticsService } from "../analytics/analytics.service";
import { DownloadService } from "../download/download.service";
import { FileService } from "../files/file.service";
import { AddonStorageService } from "../storage/addon-storage.service";
import { TocService } from "../toc/toc.service";
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
  private readonly _installQueue = new Subject<InstallQueueItem>();

  public readonly addonInstalled$ = this._addonInstalledSrc.asObservable();
  public readonly addonRemoved$ = this._addonRemovedSrc.asObservable();
  public readonly scanUpdate$ = this._scanUpdateSrc.asObservable();
  public readonly installError$ = this._installErrorSrc.asObservable();
  public readonly syncError$ = this._syncErrorSrc.asObservable();
  public readonly scanError$ = this._scanErrorSrc.asObservable();

  constructor(
    private _addonStorage: AddonStorageService,
    private _analyticsService: AnalyticsService,
    private _warcraftService: WarcraftService,
    private _wowUpService: WowUpService,
    private _downloadService: DownloadService,
    private _fileService: FileService,
    private _tocService: TocService,
    addonProviderFactory: AddonProviderFactory
  ) {
    // Create our base set of addon providers
    this._addonProviders = addonProviderFactory.getAll();

    // Setup our install queue pump here
    this._installQueue.pipe(mergeMap((item) => from(this.processInstallQueue(item)), 3)).subscribe({
      next: (addonName) => {
        console.log("Install complete", addonName);
      },
      error: (error) => {
        console.error(error);
        this._installErrorSrc.next(error);
      },
    });

    // Attempt to remove addons for clients that were lost
    this._warcraftService.installedClientTypes$
      .pipe(
        filter((clientTypes) => !!clientTypes),
        switchMap((clientTypes) => from(this.reconcileOrphanAddons(clientTypes)))
      )
      .subscribe(() => {
        console.debug("reconcileOrphanAddons complete");
      });
  }

  public canShowChangelog(providerName: string): boolean {
    return this.getProvider(providerName)?.canShowChangelog ?? false;
  }

  public canShowAddonChangelog(addon: Addon): boolean {
    return this.canShowChangelog(addon.providerName);
  }

  public isSameAddon(addon1: Addon, addon2: Addon): boolean {
    return addon1.externalId === addon2.externalId && addon1.providerName === addon2.providerName;
  }

  public async getFullDescription(
    clientType: WowClientType,
    providerName: string,
    externalId: string,
    addon?: Addon
  ): Promise<string> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      return "";
    }

    return await provider.getDescription(clientType, externalId, addon);
  }

  public async getChangelogForSearchResult(
    clientType: WowClientType,
    channelType: AddonChannelType,
    searchResult: AddonSearchResult
  ): Promise<string> {
    try {
      const provider = this.getProvider(searchResult.providerName);
      if (!provider) {
        return "";
      }

      const latestFile = this.getLatestFile(searchResult, channelType);
      return await provider.getChangelog(clientType, searchResult.externalId, latestFile.externalId);
    } catch (e) {
      console.error("Failed to get searchResult changelog", e);
      return "";
    }
  }

  public async getChangelogForAddon(clientType: WowClientType, addon: Addon): Promise<string> {
    if (!addon) {
      return "";
    }

    if (addon.latestChangelog && addon.latestChangelogVersion === addon.latestVersion) {
      return addon.latestChangelog;
    }

    try {
      const provider = this.getProvider(addon.providerName);
      if (!provider) {
        return "";
      }

      const changelog = await provider.getChangelog(clientType, addon.externalId, addon.externalLatestReleaseId);

      // addon.latestChangelogVersion = addon.latestVersion;
      // addon.latestChangelog = changelog;
      // this.saveAddon(addon);

      return changelog;
    } catch (e) {
      console.error("Failed to get addon changelog", e);
      return "";
    }
  }

  public isForceIgnore(addon: Addon): boolean {
    return addon.providerName === ADDON_PROVIDER_UNKNOWN || this.getProvider(addon.providerName).forceIgnore;
  }

  public canReinstall(addon: Addon): boolean {
    return addon.providerName !== ADDON_PROVIDER_UNKNOWN && this.getProvider(addon.providerName).allowReinstall;
  }

  public canChangeChannel(addon: Addon): boolean {
    return addon.providerName !== ADDON_PROVIDER_UNKNOWN && this.getProvider(addon.providerName).allowChannelChange;
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

  public saveAddon(addon: Addon): void {
    this._addonStorage.set(addon.id, addon);
  }

  public async search(query: string, clientType: WowClientType): Promise<AddonSearchResult[]> {
    const searchTasks = this.getEnabledAddonProviders().map(async (p) => {
      try {
        return await p.searchByQuery(query, clientType);
      } catch (e) {
        console.error(`Failed during search: ${p.name}`, e);
        return [];
      }
    });

    const searchResults = await Promise.all(searchTasks);

    this._analyticsService.trackAction("addon-search", {
      clientType: getEnumName(WowClientType, clientType),
      query,
    });

    const flatResults = searchResults.flat(1);

    return _.orderBy(flatResults, "downloadCount").reverse();
  }

  public async installPotentialAddon(
    potentialAddon: AddonSearchResult,
    clientType: WowClientType,
    onUpdate: (installState: AddonInstallState, progress: number) => void = undefined
  ): Promise<void> {
    const existingAddon = this._addonStorage.getByExternalId(potentialAddon.externalId, clientType);
    if (existingAddon) {
      throw new Error("Addon already installed");
    }

    const addon = await this.getAddon(potentialAddon.externalId, potentialAddon.providerName, clientType).toPromise();
    this._addonStorage.set(addon.id, addon);

    await this.installAddon(addon.id, onUpdate);
  }

  public getRequiredDependencies(addon: Addon): AddonDependency[] {
    return _.filter(addon.dependencies, (dep) => dep.type === AddonDependencyType.Required);
  }

  public async installDependencies(
    addon: Addon,
    onUpdate: (installState: AddonInstallState, progress: number) => void = undefined
  ): Promise<void> {
    if (!addon.dependencies) {
      console.log(`${addon.name}: No dependencies found`);
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
      const existingAddon = this._addonStorage.getByExternalId(dependency.externalAddonId, addon.clientType);
      if (existingAddon) {
        continue;
      }

      const dependencyAddon = await this.getAddon(
        dependency.externalAddonId,
        addon.providerName,
        addon.clientType
      ).toPromise();

      if (!dependencyAddon) {
        console.warn(
          `No addon was found EID: ${dependency.externalAddonId} CP: ${addon.providerName} CT: ${addon.clientType}`
        );
        continue;
      }

      this._addonStorage.set(dependencyAddon.id, dependencyAddon);

      await this.installAddon(dependencyAddon.id);
    }
  }

  public async processAutoUpdates(): Promise<Addon[]> {
    const autoUpdateAddons = this.getAutoUpdateEnabledAddons();
    const clientTypeGroups = _.groupBy(autoUpdateAddons, (addon) => addon.clientType);
    const updatedAddons = [];

    for (const clientTypeStr in clientTypeGroups) {
      try {
        const clientUpdates = await this.autoUpdateClient(clientTypeStr, clientTypeGroups[clientTypeStr]);
        updatedAddons.push(...clientUpdates);
      } catch (e) {
        console.error(`Failed to auto update ${clientTypeStr}`, e);
      }
    }

    return updatedAddons;
  }

  private async autoUpdateClient(clientTypeStr: string, addons: Addon[]) {
    const updatedAddons: Addon[] = [];
    const clientType: WowClientType = parseInt(clientTypeStr, 10);

    await this.syncAddons(clientType, addons);

    for (const addon of addons) {
      if (!this.canUpdateAddon(addon)) {
        continue;
      }

      try {
        await this.updateAddon(addon.id);
        updatedAddons.push(addon);
      } catch (err) {
        console.error(err);
      }
    }

    return updatedAddons;
  }

  public canUpdateAddon(addon: Addon): boolean {
    return addon.installedVersion && addon.installedVersion !== addon.latestVersion;
  }

  public getAutoUpdateEnabledAddons(): Addon[] {
    return this._addonStorage.queryAll((addon) => {
      return addon.isIgnored !== true && addon.autoUpdateEnabled;
    });
  }

  public updateAddon(
    addonId: string,
    onUpdate: (installState: AddonInstallState, progress: number) => void = undefined,
    originalAddon: Addon = undefined
  ): Promise<void> {
    return this.installOrUpdateAddon(addonId, "update", onUpdate, originalAddon);
  }

  public installAddon(
    addonId: string,
    onUpdate: (installState: AddonInstallState, progress: number) => void = undefined,
    originalAddon: Addon = undefined
  ): Promise<void> {
    return this.installOrUpdateAddon(addonId, "install", onUpdate, originalAddon);
  }

  public installOrUpdateAddon(
    addonId: string,
    installType: InstallType,
    onUpdate: (installState: AddonInstallState, progress: number) => void = undefined,
    originalAddon: Addon = undefined
  ): Promise<void> {
    const addon = this.getAddonById(addonId);
    if (addon == null || !addon.downloadUrl) {
      throw new Error("Addon not found or invalid");
    }

    onUpdate?.call(this, AddonInstallState.Pending, 0);
    this._addonInstalledSrc.next({
      addon,
      installState: AddonInstallState.Pending,
      progress: 0,
    });

    // create a ref for resolving or rejecting once the queue grabs this.
    let completion = { resolve: undefined, reject: undefined };
    const promise = new Promise<void>((resolve, reject) => {
      completion = { resolve, reject };
    });

    this._installQueue.next({
      addonId,
      onUpdate,
      completion,
      installType,
      originalAddon: originalAddon ? { ...originalAddon } : undefined,
    });

    return promise;
  }

  private processInstallQueue = async (queueItem: InstallQueueItem): Promise<string> => {
    const addonId = queueItem.addonId;
    const onUpdate = queueItem.onUpdate;

    const addon = this.getAddonById(addonId);
    if (addon == null || !addon.downloadUrl) {
      throw new Error("Addon not found or invalid");
    }

    const addonProvider = this.getProvider(addon.providerName);
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

      const unzipPath = path.join(this._wowUpService.applicationDownloadsFolderPath, uuidv4());
      unzippedDirectory = await this._fileService.unzipFile(downloadedFilePath, unzipPath);

      try {
        await this.installUnzippedDirectory(unzippedDirectory, addon.clientType);
      } catch (err) {
        console.error(err);
        await this.restoreAddonDirectories(directoriesToBeRemoved);

        throw err;
      }

      for (const directory of directoriesToBeRemoved) {
        console.log("Removing backup", directory);
        await this._fileService.deleteIfExists(directory);
      }

      const unzippedDirectoryNames = await this._fileService.listDirectories(unzippedDirectory);
      const existingDirectoryNames = this.getInstalledFolders(addon);
      const addedDirectoryNames = _.difference(unzippedDirectoryNames, existingDirectoryNames);
      const removedDirectoryNames = _.difference(existingDirectoryNames, unzippedDirectoryNames);

      if (existingDirectoryNames.length > 0) {
        console.log("Addon added new directories", addedDirectoryNames);
      }

      if (removedDirectoryNames.length > 0) {
        console.log("Addon removed existing directories", removedDirectoryNames);
      }

      addon.installedExternalReleaseId = addon.externalLatestReleaseId;
      addon.installedVersion = addon.latestVersion;
      addon.installedAt = new Date();
      addon.installedFolderList = unzippedDirectoryNames;
      addon.installedFolders = unzippedDirectoryNames.join(",");
      addon.isIgnored = addonProvider.forceIgnore;

      const allTocFiles = await this.getAllTocs(unzippedDirectory, unzippedDirectoryNames);
      const gameVersion = this.getLatestGameVersion(allTocFiles);
      if (gameVersion) {
        addon.gameVersion = gameVersion;
      }

      if (!addon.author) {
        addon.author = this.getBestGuessAuthor(allTocFiles);
      }

      // If this is a zip file addon, try to pull the name out of the toc
      if (addonProvider.name === ADDON_PROVIDER_ZIP) {
        addon.name = this.getBestGuessTitle(allTocFiles);
      }

      this._addonStorage.set(addon.id, addon);

      this.trackInstallAction(queueItem.installType, addon);

      await this.installDependencies(addon, onUpdate);

      await this.backfillAddon(addon);
      this.reconcileExternalIds(addon, queueItem.originalAddon);
      await this.reconcileAddonFolders(addon);

      queueItem.completion.resolve();

      onUpdate?.call(this, AddonInstallState.Complete, 100);
      this._addonInstalledSrc.next({
        addon,
        installState: AddonInstallState.Complete,
        progress: 100,
      });
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
    const curseProvider = this._addonProviders.find((p) => p.name === ADDON_PROVIDER_CURSEFORGE) as CurseAddonProvider;
    const hubProvider = this._addonProviders.find((p) => p.name === ADDON_PROVIDER_HUB) as WowUpAddonProvider;

    const clientMap = {};
    const clientTypes = await this._warcraftService.getWowClientTypes();
    for (const clientType of clientTypes) {
      const clientTypeName = this._warcraftService.getClientFolderName(clientType);
      const addonFolders = await this._warcraftService.listAddons(clientType);

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

  private async getAllTocs(baseDir: string, installedFolders: string[]) {
    const tocs: Toc[] = [];

    for (const dir of installedFolders) {
      const dirPath = path.join(baseDir, dir);

      const tocFiles = await this._fileService.listFiles(dirPath, "*.toc");
      const tocFile = _.first(tocFiles);
      if (!tocFile) {
        continue;
      }

      const tocPath = path.join(dirPath, tocFile);
      const toc = await this._tocService.parse(tocPath);
      if (!toc.interface) {
        continue;
      }

      tocs.push(toc);
    }

    return tocs;
  }

  private getBestGuessTitle(tocs: Toc[]) {
    const titles = _.map(tocs, (toc) => toc.title).filter((title) => !!title);
    return _.maxBy(titles, (title) => title.length);
  }

  private getBestGuessAuthor(tocs: Toc[]) {
    const authors = _.map(tocs, (toc) => toc.author).filter((author) => !!author);
    return _.maxBy(authors, (author) => author.length);
  }

  private getLatestGameVersion(tocs: Toc[]) {
    const versions = _.map(tocs, (toc) => toc.interface);
    return AddonUtils.getGameVersion(_.orderBy(versions, null, "desc")[0] || "");
  }

  private async backupOriginalDirectories(addon: Addon) {
    const installedFolders = this.getInstalledFolders(addon);
    const addonFolderPath = this._warcraftService.getAddonFolderPath(addon.clientType);

    const backupFolders = [];
    for (const addonFolder of installedFolders) {
      const currentAddonLocation = path.join(addonFolderPath, addonFolder);
      const addonFolderBackupLocation = path.join(addonFolderPath, `${addonFolder}-bak`);

      console.log("Ensure existing backup is deleted", addonFolderBackupLocation);
      await this._fileService.deleteIfExists(addonFolderBackupLocation);

      if (await this._fileService.pathExists(currentAddonLocation)) {
        console.log("Backing up", currentAddonLocation);
        await this._fileService.copy(currentAddonLocation, addonFolderBackupLocation);
        await this._fileService.remove(currentAddonLocation);

        backupFolders.push(addonFolderBackupLocation);
      }
    }

    return backupFolders;
  }

  private async restoreAddonDirectories(directories: string[]) {
    console.log("Attempting to restore addon directories based on backups");
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
        console.log(`Attempting to roll back ${directory}`);
        await this._fileService.copy(directory, originalLocation);
      }
    }
  }

  private async installUnzippedDirectory(unzippedDirectory: string, clientType: WowClientType) {
    const addonFolderPath = this._warcraftService.getAddonFolderPath(clientType);
    const unzippedFolders = await this._fileService.listDirectories(unzippedDirectory);
    for (const unzippedFolder of unzippedFolders) {
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

  public getAddonById(addonId: string): Addon {
    return this._addonStorage.get(addonId);
  }

  public async getAddonByUrl(url: URL, clientType: WowClientType): Promise<AddonSearchResult | undefined> {
    const provider = this.getAddonProvider(url);
    if (!provider) {
      console.warn(`No provider found for urlL: ${url.toString()}`);
      return undefined;
    }

    return await provider.searchByUrl(url, clientType);
  }

  public getAddon(externalId: string, providerName: string, clientType: WowClientType): Observable<Addon | undefined> {
    const targetAddonChannel = this._wowUpService.getDefaultAddonChannel(clientType);
    const provider = this.getProvider(providerName);
    return provider.getById(externalId, clientType).pipe(
      map((searchResult) => {
        if (!searchResult) {
          return undefined;
        }

        let latestFile = this.getLatestFile(searchResult, targetAddonChannel);
        if (!latestFile) {
          latestFile = searchResult.files[0];
        }

        return this.createAddon(latestFile.folders[0], searchResult, latestFile, clientType);
      })
    );
  }

  public getInstallBasePath(addon: Addon): string {
    return this._warcraftService.getAddonFolderPath(addon.clientType);
  }

  public getFullInstallPath(addon: Addon): string {
    const addonFolderPath = this._warcraftService.getAddonFolderPath(addon.clientType);
    const installedFolders = this.getInstalledFolders(addon);
    return path.join(addonFolderPath, _.first(installedFolders));
  }

  public getInstalledFolders(addon: Addon): string[] {
    const folders = addon?.installedFolders || "";
    if (!folders) {
      return [];
    }

    return folders
      .split(",")
      .map((f) => f.trim())
      .filter((f) => !!f);
  }

  public async removeAddon(addon: Addon, removeDependencies = false, removeDirectories = true): Promise<void> {
    const installedDirectories = addon.installedFolders?.split(",") ?? [];
    const addonFolderPath = this._warcraftService.getAddonFolderPath(addon.clientType);

    if (removeDirectories) {
      for (const directory of installedDirectories) {
        const addonDirectory = path.join(addonFolderPath, directory);
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
    for (const dependency of addon.dependencies) {
      const dependencyAddon = this.getByExternalId(dependency.externalAddonId, addon.clientType);
      if (!dependencyAddon) {
        console.log(`${addon.name}: Dependency not found ${dependency.externalAddonId}`);
        continue;
      }

      await this.removeAddon(dependencyAddon);
    }
  }

  public getAllAddons(clientType: WowClientType): Addon[] {
    return this._addonStorage.getAllForClientType(clientType);
  }

  public async getAddons(clientType: WowClientType, rescan = false): Promise<Addon[]> {
    if (clientType === WowClientType.None) {
      return [];
    }

    let addons = this._addonStorage.getAllForClientType(clientType);

    if (rescan || addons.length === 0) {
      const newAddons = await this.scanAddons(clientType);
      this._addonStorage.removeAllForClientType(clientType);

      addons = this.updateAddons(addons, newAddons);
      this._addonStorage.saveAll(addons);
    }

    // Only sync non-ignored addons
    const notIgnored = _.filter(addons, (addon) => addon.isIgnored === false);

    return addons;
  }

  public async syncAllClients(): Promise<void> {
    const clientTypes = await this._warcraftService.getWowClientTypes();
    for (const clientType of clientTypes) {
      try {
        await this.syncClientAddons(clientType);
      } catch (e) {
        console.error(e);
      }
    }
  }

  public async syncClientAddons(clientType: WowClientType): Promise<void> {
    try {
      const addons = this._addonStorage.getAllForClientType(clientType);
      const validAddons = _.filter(addons, (addon) => addon.isIgnored === false);

      await this.syncAddons(clientType, validAddons);
    } catch (e) {
      console.error(e);
    }
  }

  public async syncAddons(clientType: WowClientType, addons: Addon[]): Promise<boolean> {
    console.debug(`syncAddons ${getEnumName(WowClientType, clientType)}`);
    let didSync = true;

    for (const provider of this.getEnabledAddonProviders()) {
      try {
        await this.syncProviderAddons(clientType, addons, provider);
      } catch (e) {
        console.error(`Failed to sync from provider: ${provider.name}`, e);
        this._syncErrorSrc.next(
          new AddonSyncError({
            providerName: provider.name,
            innerError: e,
          })
        );
        didSync = false;
      }
    }

    return didSync;
  }

  private updateAddons(existingAddons: Addon[], newAddons: Addon[]) {
    _.forEach(newAddons, (newAddon) => {
      const existingAddon = _.find(
        existingAddons,
        (ea) => ea.externalId.toString() === newAddon.externalId.toString() && ea.providerName == newAddon.providerName
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

  private addonsMatch(addon1: Addon, addon2: Addon): boolean {
    return (
      addon1.externalId == addon2.externalId &&
      addon1.providerName == addon2.providerName &&
      addon1.clientType == addon2.clientType
    );
  }

  private async syncProviderAddons(clientType: WowClientType, addons: Addon[], addonProvider: AddonProvider) {
    // console.debug(`syncProviderAddons ${getEnumName(WowClientType, clientType)} ${addonProvider.name}`);
    const providerAddonIds = this.getExternalIdsForProvider(addonProvider, addons);
    if (!providerAddonIds.length) {
      return;
    }

    const getAllResults = await addonProvider.getAll(clientType, providerAddonIds);
    for (const error of getAllResults.errors) {
      const addonId = (error as any).addonId;
      let addon: Addon;
      if (addonId) {
        addon = _.find(addons, (a) => a.externalId === addonId);
      }

      this._syncErrorSrc.next(
        new AddonSyncError({
          providerName: addonProvider.name,
          innerError: error,
          addonName: addon?.name,
        })
      );
    }

    for (const result of getAllResults.searchResults) {
      const addon = addons.find((addon) => addon.externalId.toString() === result?.externalId?.toString());
      const latestFile = this.getLatestFile(result, addon?.channelType);

      this.setExternalIdString(addon);

      addon.summary = result.summary;
      addon.thumbnailUrl = result.thumbnailUrl;
      addon.latestChangelog = latestFile?.changelog || addon.latestChangelog;

      if (latestFile?.externalId && latestFile.externalId === addon.externalLatestReleaseId) {
        continue;
      } else if (
        !result ||
        !latestFile ||
        (latestFile.version === addon.latestVersion && latestFile.releaseDate === addon.releasedAt)
      ) {
        this._addonStorage.set(addon.id, addon);
        continue;
      }

      addon.latestVersion = latestFile.version;
      addon.releasedAt = latestFile.releaseDate;
      addon.downloadUrl = latestFile.downloadUrl;
      addon.externalLatestReleaseId = latestFile.externalId;
      addon.name = result.name;
      addon.author = result.author;
      addon.externalChannel = getEnumName(AddonChannelType, latestFile.channelType);

      if (latestFile.gameVersion) {
        addon.gameVersion = AddonUtils.getGameVersion(latestFile.gameVersion);
      } else {
        addon.gameVersion = AddonUtils.getGameVersion(addon.gameVersion);
      }

      addon.externalUrl = result.externalUrl;

      this._addonStorage.set(addon.id, addon);
    }
  }

  // Legacy TukUI/ElvUI ids were ints, correct them
  private setExternalIdString(addon: Addon) {
    if (typeof addon.externalId === "string") {
      return;
    }

    addon.externalId = `${addon.externalId as string}`;
    this._addonStorage.set(addon.id, addon);
  }

  private getExternalIdsForProvider(addonProvider: AddonProvider, addons: Addon[]): string[] {
    return addons.filter((addon) => addon.providerName === addonProvider.name).map((addon) => addon.externalId);
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

  public async migrate(clientType: WowClientType): Promise<void> {
    console.log(`Migrating: ${getEnumName(WowClientType, clientType)}`);
    const existingAddons = this.getAllAddons(clientType);
    if (!existingAddons.length) {
      console.log(`Skipping client type: ${clientType} no addons found`);
      return;
    }

    const scannedAddons = await this.scanAddons(clientType);
    for (const addon of existingAddons) {
      this.migrateAddon(addon, scannedAddons);
    }
  }

  private migrateAddon(addon: Addon, scannedAddons: Addon[]): void {
    if (addon.providerName === ADDON_PROVIDER_HUB_LEGACY) {
      console.log(`Updating legacy hub name: ${addon.name}`);
      addon.providerName = ADDON_PROVIDER_HUB;
      this.saveAddon(addon);
    }

    const scannedAddon = _.find(
      scannedAddons,
      (sa) => sa.externalId === addon.externalId && addon.providerName === sa.providerName
    );

    if (!scannedAddon) {
      console.log(`No scanned addon found ${addon.name}`);
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

  private async scanAddons(clientType: WowClientType): Promise<Addon[]> {
    if (clientType === WowClientType.None) {
      return [];
    }

    this._scanUpdateSrc.next({
      type: ScanUpdateType.Start,
    });

    try {
      const defaultAddonChannel = this._wowUpService.getDefaultAddonChannel(clientType);
      const addonFolders = await this._warcraftService.listAddons(clientType);

      await this.removeGitFolders(addonFolders);

      this._scanUpdateSrc.next({
        type: ScanUpdateType.Update,
        currentCount: 0,
        totalCount: addonFolders.length,
      });

      for (const provider of this._addonProviders) {
        try {
          const validFolders = addonFolders.filter((af) => !af.ignoreReason && !af.matchingAddon && af.toc);
          await provider.scan(clientType, defaultAddonChannel, validFolders);
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

      matchedAddonFolders.forEach((maf) => this.setExternalIds(maf.matchingAddon, maf.toc));
      const matchedGroups = _.groupBy(
        matchedAddonFolders,
        (addonFolder) => `${addonFolder.matchingAddon.providerName}${addonFolder.matchingAddon.externalId}`
      );

      console.log(Object.keys(matchedGroups));

      const addonList = Object.values(matchedGroups).map(
        (value) => _.orderBy(value, (v) => v.matchingAddon.externalIds.length).reverse()[0].matchingAddon
      );

      const unmatchedFolders = addonFolders.filter((af) => this.isAddonFolderUnmatched(matchedAddonFolderNames, af));
      console.debug("unmatchedFolders", unmatchedFolders);

      const unmatchedAddons = unmatchedFolders.map((uf) =>
        this.createUnmatchedAddon(uf, clientType, matchedAddonFolderNames)
      );

      console.debug("unmatchedAddons", unmatchedAddons);

      addonList.push(...unmatchedAddons);

      //Clear the changelogs since they wont always be latest
      addonList.forEach((addon) => {
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
      this.insertExternalId(externalIds, addon.providerName, addon.externalId);
    }

    addon.externalIds = externalIds;
  }

  private async reconcileAddonFolders(addon: Addon) {
    let existingAddons = await this.getAddons(addon.clientType);
    existingAddons = _.filter(
      existingAddons,
      (ea) => ea.id !== addon.id && _.intersection(addon.installedFolderList, ea.installedFolderList).length > 0
    );

    console.debug("reconcileAddonFolders", existingAddons);

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
  private isAddonFolderUnmatched(matchedFolderNames: string[], addonFolder: AddonFolder) {
    if (addonFolder.matchingAddon) {
      return false;
    }

    // if the folder is load on demand, it 'should' be a sub folder
    const isLoadOnDemand = addonFolder.toc?.loadOnDemand === "1";
    if (isLoadOnDemand && this.allItemsMatch(addonFolder.toc.dependencyList, matchedFolderNames)) {
      return false;
    }

    return true;
  }

  /** Check if all primitives in subset are in the superset (strings, ints) */
  private allItemsMatch(subset: any[], superset: any[]) {
    return _.difference(subset, superset).length === 0;
  }

  public insertExternalId(externalIds: AddonExternalId[], providerName: string, addonId?: string): void {
    if (!addonId || providerName === ADDON_PROVIDER_RAIDERIO) {
      return;
    }

    const exists =
      _.findIndex(externalIds, (extId) => extId.id === addonId && extId.providerName === providerName) !== -1;

    if (exists) {
      console.debug(`External id exists ${providerName}|${addonId}`);
      return;
    }

    if (this.getProvider(providerName).isValidAddonId(addonId)) {
      externalIds.push({
        id: addonId,
        providerName: providerName,
      });
    } else {
      console.warn(`Invalid provider id ${providerName}|${addonId}`);
    }
  }

  public async setProvider(
    addon: Addon,
    externalId: string,
    providerName: string,
    clientType: WowClientType
  ): Promise<void> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    if (this.isInstalled(externalId, clientType)) {
      throw new Error(ERROR_ADDON_ALREADY_INSTALLED);
    }

    const externalAddon = await this.getAddon(externalId, providerName, clientType).toPromise();
    if (!externalAddon) {
      throw new Error(`External addon not found: ${providerName}|${externalId}`);
    }

    this.saveAddon(externalAddon);
    await this.installAddon(externalAddon.id, undefined, addon);

    await this.removeAddon(addon, false, false);
  }

  public async reconcileOrphanAddons(installedClientTypes: WowClientType[]): Promise<void> {
    console.debug("reconcileOrphanAddons", installedClientTypes);
    const clientTypes = this._warcraftService.getAllClientTypes();
    const unusedClients = _.difference(clientTypes, installedClientTypes);
    console.debug("unusedClients", unusedClients);

    for (const clientType of unusedClients) {
      const addons = this._addonStorage.getAllForClientType(clientType);
      for (const addon of addons) {
        await this.removeAddon(addon, false, false);
      }
    }
  }

  public reconcileExternalIds(newAddon: Addon, oldAddon: Addon): void {
    if (!newAddon || !oldAddon) {
      return;
    }

    // Ensure all previously existing external ids are brought along during the swap
    // some addons are not always the same between providers ;)
    oldAddon.externalIds.forEach((oldExtId) => {
      const match = newAddon.externalIds.find(
        (newExtId) => newExtId.id === oldExtId.id && newExtId.providerName === oldExtId.providerName
      );
      if (match) {
        return;
      }
      console.log(`Reconciling external id: ${oldExtId.providerName}|${oldExtId.id}`);
      newAddon.externalIds.push({ ...oldExtId });
    });

    // Remove external ids that are not valid that we may have saved previously
    _.remove(newAddon.externalIds, (extId) => !this.getProvider(extId.providerName).isValidAddonId(extId.id));

    this.saveAddon(newAddon);
  }

  public getFeaturedAddons(clientType: WowClientType): Observable<AddonSearchResult[]> {
    return forkJoin(
      this.getEnabledAddonProviders().map(async (p) => {
        try {
          return await p.getFeaturedAddons(clientType);
        } catch (e) {
          console.error(`Failed to get featured addons: ${p.name}`, e);
          return [];
        }
      })
    ).pipe(
      map((results) => {
        return _.orderBy(results.flat(1), ["downloadCount"]).reverse();
      })
    );
  }

  public getByExternalId(externalId: string, clientType: WowClientType): Addon {
    return this._addonStorage.getByExternalId(externalId, clientType);
  }

  public isInstalled(externalId: string, clientType: WowClientType): boolean {
    return !!this.getByExternalId(externalId, clientType);
  }

  public setProviderEnabled(providerName: string, enabled: boolean): void {
    const provider = this.getProvider(providerName);
    if (provider) {
      provider.enabled = enabled;
    }
  }

  private getProvider(providerName: string) {
    return this._addonProviders.find((provider) => provider.name === providerName);
  }

  public async backfillAddons(): Promise<void> {
    const clientTypes = this._warcraftService.getAllClientTypes();

    for (const clientType of clientTypes) {
      const addons = this._addonStorage.getAllForClientType(clientType);
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
      this.setExternalIds(addon, primaryToc);
      this.saveAddon(addon);
    } catch (e) {
      console.error(e);
    }
  }

  public containsOwnExternalId(addon: Addon, array?: AddonExternalId[]): boolean {
    const arr = array || addon.externalIds;
    const result = arr && !!arr.find((ext) => ext.id === addon.externalId && ext.providerName === addon.providerName);
    return result;
  }

  public getTocPaths(addon: Addon): string[] {
    const addonFolderPath = this._warcraftService.getAddonFolderPath(addon.clientType);
    const installedFolders = this.getInstalledFolders(addon);

    return _.map(installedFolders, (installedFolder) =>
      path.join(addonFolderPath, installedFolder, `${installedFolder}.toc`)
    );
  }

  private getAddonProvider(addonUri: URL): AddonProvider {
    return this.getEnabledAddonProviders().find((provider) => provider.isValidAddonUri(addonUri));
  }

  private getLatestFile(
    searchResult: AddonSearchResult,
    channelType: AddonChannelType
  ): AddonSearchResultFile | undefined {
    if (!searchResult?.files) {
      console.warn("Search result had no files", searchResult);
      return undefined;
    }

    let files = _.filter(searchResult.files, (f: AddonSearchResultFile) => f.channelType <= channelType);
    files = _.orderBy(files, ["releaseDate"]).reverse();
    return _.first(files);
  }

  private createAddon(
    folderName: string,
    searchResult: AddonSearchResult,
    latestFile: AddonSearchResultFile,
    clientType: WowClientType
  ): Addon {
    if (latestFile == null) {
      return null;
    }

    const dependencies = _.map(latestFile.dependencies, this.createAddonDependency);
    const fundingLinks = Array.isArray(searchResult.fundingLinks) ? [...searchResult.fundingLinks] : [];

    return {
      id: uuidv4(),
      name: searchResult.name,
      thumbnailUrl: searchResult.thumbnailUrl,
      latestVersion: latestFile.version,
      clientType: clientType,
      externalId: searchResult.externalId.toString(),
      gameVersion: AddonUtils.getGameVersion(latestFile.gameVersion),
      author: searchResult.author,
      downloadUrl: latestFile.downloadUrl,
      externalUrl: searchResult.externalUrl,
      providerName: searchResult.providerName,
      channelType: this._wowUpService.getDefaultAddonChannel(clientType),
      isIgnored: false,
      autoUpdateEnabled: this._wowUpService.getDefaultAutoUpdate(clientType),
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
    };
  }

  private createUnmatchedAddon(
    addonFolder: AddonFolder,
    clientType: WowClientType,
    matchedAddonFolderNames: string[]
  ): Addon {
    const tocMissingDependencies = _.difference(addonFolder.toc?.dependencyList, matchedAddonFolderNames);

    return {
      id: uuidv4(),
      name: addonFolder.toc?.title || addonFolder.name,
      thumbnailUrl: "",
      latestVersion: addonFolder.toc?.version || "",
      installedVersion: addonFolder.toc?.version || "",
      clientType: clientType,
      externalId: "",
      gameVersion: addonFolder.toc?.interface || "",
      author: addonFolder.toc?.author || "",
      downloadUrl: "",
      externalUrl: "",
      providerName: ADDON_PROVIDER_UNKNOWN,
      channelType: AddonChannelType.Stable,
      isIgnored: true,
      autoUpdateEnabled: false,
      releasedAt: new Date(),
      installedAt: addonFolder.fileStats?.mtime || new Date(),
      installedFolders: addonFolder.name,
      installedFolderList: [addonFolder.name],
      summary: "",
      screenshotUrls: [],
      isLoadOnDemand: addonFolder.toc?.loadOnDemand === "1",
      externalChannel: getEnumName(AddonChannelType, AddonChannelType.Stable),
      missingDependencies: tocMissingDependencies,
      ignoreReason: addonFolder.ignoreReason,
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
    this._analyticsService.trackAction(`addon-install-action`, {
      clientType: getEnumName(WowClientType, addon.clientType),
      provider: addon.providerName,
      addon: addon.name,
      addonId: addon.externalId,
      installType,
    });
  }
}
