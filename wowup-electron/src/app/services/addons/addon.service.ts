import { Injectable } from "@angular/core";
import { AddonDependency } from "app/models/wowup/addon-dependency";
import { AddonDependencyType } from "app/models/wowup/addon-dependency-type";
import { AddonSearchResultDependency } from "app/models/wowup/addon-search-result-dependency";
import { Toc } from "app/models/wowup/toc";
import { ADDON_PROVIDER_CURSEFORGE, ADDON_PROVIDER_TUKUI, ADDON_PROVIDER_WOWINTERFACE } from "common/constants";
import * as fs from "fs";
import * as _ from "lodash";
import * as path from "path";
import { forkJoin, from, Observable, Subject } from "rxjs";
import { map, mergeMap } from "rxjs/operators";
import * as slug from "slug";
import { v4 as uuidv4 } from "uuid";
import { AddonProvider } from "../../addon-providers/addon-provider";
import { CurseAddonProvider } from "../../addon-providers/curse-addon-provider";
import { Addon, AddonExternalId } from "../../entities/addon";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { AddonChannelType } from "../../models/wowup/addon-channel-type";
import { AddonFolder } from "../../models/wowup/addon-folder";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { AddonSearchResult } from "../../models/wowup/addon-search-result";
import { AddonSearchResultFile } from "../../models/wowup/addon-search-result-file";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { getEnumList, getEnumName } from "../../utils/enum.utils";
import { AnalyticsService } from "../analytics/analytics.service";
import { DownloadService } from "../download/download.service";
import { FileService } from "../files/file.service";
import { AddonStorageService } from "../storage/addon-storage.service";
import { TocService } from "../toc/toc.service";
import { WarcraftService } from "../warcraft/warcraft.service";
import { WowUpService } from "../wowup/wowup.service";
import { AddonProviderFactory } from "./addon.provider.factory";

interface InstallQueueItem {
  addonId: string;
  onUpdate: (installState: AddonInstallState, progress: number) => void | undefined;
  completion: any;
}

@Injectable({
  providedIn: "root",
})
export class AddonService {
  private readonly _addonProviders: AddonProvider[];
  private readonly _addonInstalledSrc = new Subject<AddonUpdateEvent>();
  private readonly _addonRemovedSrc = new Subject<string>();
  private readonly _installQueue = new Subject<InstallQueueItem>();

  public readonly addonInstalled$ = this._addonInstalledSrc.asObservable();
  public readonly addonRemoved$ = this._addonRemovedSrc.asObservable();

  constructor(
    private _addonStorage: AddonStorageService,
    private _analyticsService: AnalyticsService,
    private _warcraftService: WarcraftService,
    private _wowUpService: WowUpService,
    private _downloadService: DownloadService,
    private _fileService: FileService,
    private _tocService: TocService,
    private _addonProviderFactory: AddonProviderFactory
  ) {
    this._addonProviders = [
      this._addonProviderFactory.createCurseAddonProvider(),
      this._addonProviderFactory.createTukUiAddonProvider(),
      this._addonProviderFactory.createWowInterfaceAddonProvider(),
      this._addonProviderFactory.createGitHubAddonProvider(),
    ];

    this._installQueue.pipe(mergeMap((item) => from(this.processInstallQueue(item)), 3)).subscribe((addonName) => {
      console.log("Install complete", addonName);
    });
  }

  public saveAddon(addon: Addon) {
    this._addonStorage.set(addon.id, addon);
  }

  public async search(query: string, clientType: WowClientType): Promise<AddonSearchResult[]> {
    var searchTasks = this._addonProviders.map((p) => p.searchByQuery(query, clientType));
    var searchResults = await Promise.all(searchTasks);

    await this._analyticsService.trackAction("addon-search", {
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
  ) {
    console.debug("POTADD", potentialAddon);
    var existingAddon = this._addonStorage.getByExternalId(potentialAddon.externalId, clientType);
    if (existingAddon) {
      throw new Error("Addon already installed");
    }

    const addon = await this.getAddon(potentialAddon.externalId, potentialAddon.providerName, clientType).toPromise();
    this._addonStorage.set(addon.id, addon);

    await this.installAddon(addon.id, onUpdate);
  }

  public getRequiredDependencies(addon: Addon) {
    return _.filter(addon.dependencies, (dep) => dep.type === AddonDependencyType.Required);
  }

  public async installDependencies(
    addon: Addon,
    onUpdate: (installState: AddonInstallState, progress: number) => void = undefined
  ) {
    if (!addon.dependencies) {
      console.log(`${addon.name}: No dependencies found`);
      return;
    }

    console.debug("Deps detected", addon, onUpdate);

    const requiredDependencies = this.getRequiredDependencies(addon);
    if (!requiredDependencies.length) {
      console.log(`${addon.name}: No required dependencies found`);
      return;
    }

    console.debug("Deps detected", requiredDependencies);
    const maxCt = requiredDependencies.length;
    let currentCt = 0;
    for (let dependency of requiredDependencies) {
      currentCt += 1;
      const percent = (currentCt / maxCt) * 100;

      onUpdate?.call(this, AddonInstallState.Installing, percent);

      // If the dependency is already installed, skip it
      var existingAddon = this._addonStorage.getByExternalId(dependency.externalAddonId, addon.clientType);
      if (existingAddon) {
        continue;
      }

      const dependencyAddon = await this.getAddon(
        dependency.externalAddonId,
        addon.providerName,
        addon.clientType
      ).toPromise();

      this._addonStorage.set(dependencyAddon.id, dependencyAddon);

      console.debug("Addon dep", dependencyAddon);
      await this.installAddon(dependencyAddon.id);
    }
  }

  public async processAutoUpdates(): Promise<number> {
    const autoUpdateAddons = this.getAutoUpdateEnabledAddons();
    const clientTypeGroups = _.groupBy(autoUpdateAddons, (addon) => addon.clientType);
    let updateCt = 0;

    for (let clientTypeStr in clientTypeGroups) {
      const clientType: WowClientType = parseInt(clientTypeStr, 10);

      const synced = await this.syncAddons(clientType, clientTypeGroups[clientType]);
      if (!synced) {
        continue;
      }

      for (let addon of clientTypeGroups[clientType]) {
        if (!this.canUpdateAddon(addon)) {
          continue;
        }

        try {
          await this.installAddon(addon.id);
          updateCt += 1;
        } catch (err) {
          console.error(err);
        }
      }
    }

    return updateCt;
  }

  public canUpdateAddon(addon: Addon) {
    return addon.installedVersion && addon.installedVersion !== addon.latestVersion;
  }

  public getAutoUpdateEnabledAddons() {
    return this._addonStorage.queryAll((addon) => {
      return addon.isIgnored !== true && addon.autoUpdateEnabled;
    });
  }

  public installAddon(
    addonId: string,
    onUpdate: (installState: AddonInstallState, progress: number) => void = undefined
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

      for (let directory of directoriesToBeRemoved) {
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

      addon.installedVersion = addon.latestVersion;
      addon.installedAt = new Date();
      addon.installedFolders = unzippedDirectoryNames.join(",");

      if (!addon.gameVersion) {
        addon.gameVersion = await this.getLatestGameVersion(unzippedDirectory, unzippedDirectoryNames);
      }

      this._addonStorage.set(addon.id, addon);

      const actionLabel = `${getEnumName(WowClientType, addon.clientType)}|${addon.providerName}|${addon.externalId}|${
        addon.name
      }`;
      this._analyticsService.trackAction("install-addon", {
        clientType: getEnumName(WowClientType, addon.clientType),
        provider: addon.providerName,
        addon: actionLabel,
      });

      await this.installDependencies(addon, onUpdate);

      await this.backfillAddon(addon);

      queueItem.completion.resolve();
    } catch (err) {
      console.error(err);
      queueItem.completion.reject(err);
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

    onUpdate?.call(this, AddonInstallState.Complete, 100);
    this._addonInstalledSrc.next({
      addon,
      installState: AddonInstallState.Complete,
      progress: 100,
    });

    return addon.name;
  };

  public async logDebugData() {
    const curseProvider = this._addonProviders.find((p) => p.name === "Curse") as CurseAddonProvider;

    const clientTypes = await this._warcraftService.getWowClientTypes();
    for (let clientType of clientTypes) {
      const addonFolders = await this._warcraftService.listAddons(clientType);
      const scanResults = await curseProvider.getScanResults(addonFolders);
      const map = {};

      scanResults.forEach((sr) => (map[sr.folderName] = sr.fingerprint));

      console.log(`clientType ${this._warcraftService.getClientDisplayName(clientType)} addon fingerprints`);
      console.log(map);
    }
  }

  private async getLatestGameVersion(baseDir: string, installedFolders: string[]) {
    const versions = [];

    for (let dir of installedFolders) {
      const dirPath = path.join(baseDir, dir);

      const tocFile = this._fileService.listFiles(dirPath, "*.toc")[0];
      if (tocFile == null) {
        continue;
      }

      const tocPath = path.join(dirPath, tocFile);
      const toc = await this._tocService.parse(tocPath);
      if (!toc.interface) {
        continue;
      }

      versions.push(toc.interface);
    }

    return _.orderBy(versions)[0] || "";
  }

  private async backupOriginalDirectories(addon: Addon) {
    const installedFolders = this.getInstalledFolders(addon);
    const addonFolderPath = this._warcraftService.getAddonFolderPath(addon.clientType);

    let backupFolders = [];
    for (let addonFolder of installedFolders) {
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
    for (let directory of directories) {
      const originalLocation = directory.substring(0, directory.length - 4);

      // If a backup directory exists, attempt to roll back
      if (fs.existsSync(directory)) {
        // If the new addon folder was already created delete it
        if (fs.existsSync(originalLocation)) {
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
    for (let unzippedFolder of unzippedFolders) {
      const unzippedFilePath = path.join(unzippedDirectory, unzippedFolder);
      const unzipLocation = path.join(addonFolderPath, unzippedFolder);

      try {
        // Copy contents from unzipped new directory to existing addon folder location
        console.log("COPY", unzipLocation);
        await this._fileService.copy(unzippedFilePath, unzipLocation);
      } catch (err) {
        console.error(`Failed to copy addon directory ${unzipLocation}`);
        throw err;
      }
    }
  }

  public getAddonById(addonId: string) {
    return this._addonStorage.get(addonId);
  }

  public async getAddonByUrl(url: URL, clientType: WowClientType) {
    const provider = this.getAddonProvider(url);

    return await provider.searchByUrl(url, clientType);
  }

  public getAddon(externalId: string, providerName: string, clientType: WowClientType) {
    const targetAddonChannel = this._wowUpService.getDefaultAddonChannel(clientType);
    const provider = this.getProvider(providerName);
    return provider.getById(externalId, clientType).pipe(
      map((searchResult) => {
        console.debug("SEARCH RES", searchResult);
        let latestFile = this.getLatestFile(searchResult, targetAddonChannel);
        if (!latestFile) {
          latestFile = searchResult.files[0];
        }

        return this.createAddon(latestFile.folders[0], searchResult, latestFile, clientType);
      })
    );
  }

  public getFullInstallPath(addon: Addon) {
    const addonFolderPath = this._warcraftService.getAddonFolderPath(addon.clientType);
    const installedFolders = this.getInstalledFolders(addon);
    return path.join(addonFolderPath, _.first(installedFolders));
  }

  public getInstalledFolders(addon: Addon): string[] {
    const folders = addon?.installedFolders || "";
    return folders
      .split(",")
      .map((f) => f.trim())
      .filter((f) => !!f);
  }

  public async removeAddon(addon: Addon, removeDependencies: boolean = false) {
    const installedDirectories = addon.installedFolders?.split(",") ?? [];

    const addonFolderPath = this._warcraftService.getAddonFolderPath(addon.clientType);
    for (let directory of installedDirectories) {
      const addonDirectory = path.join(addonFolderPath, directory);
      await this._fileService.remove(addonDirectory);
    }

    this._addonStorage.remove(addon);
    this._addonRemovedSrc.next(addon.id);

    if (removeDependencies) {
      await this.removeDependencies(addon);
    }
  }

  private async removeDependencies(addon: Addon) {
    for (let dependency of addon.dependencies) {
      const dependencyAddon = this.getByExternalId(dependency.externalAddonId, addon.clientType);
      if (!dependencyAddon) {
        console.log(`${addon.name}: Dependency not found ${dependency.externalAddonId}`);
        continue;
      }

      await this.removeAddon(dependencyAddon);
    }
  }

  public async getAddons(clientType: WowClientType, rescan = false): Promise<Addon[]> {
    let addons = this._addonStorage.getAllForClientType(clientType);
    if (rescan || addons.length === 0) {
      const newAddons = await this.scanAddons(clientType);
      console.debug("newAddons", newAddons);

      this._addonStorage.removeAllForClientType(clientType);
      addons = this.updateAddons(addons, newAddons);
      this._addonStorage.saveAll(addons);
    }

    await this.syncAddons(clientType, addons);

    return addons;
  }

  private updateAddons(existingAddons: Addon[], newAddons: Addon[]) {
    _.forEach(newAddons, (newAddon) => {
      const existingAddon = _.find(
        existingAddons,
        (ea) => ea.externalId == newAddon.externalId && ea.providerName == newAddon.providerName
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

  private async syncAddons(clientType: WowClientType, addons: Addon[]) {
    try {
      for (let provider of this._addonProviders) {
        await this.syncProviderAddons(clientType, addons, provider);
      }

      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  private async syncProviderAddons(clientType: WowClientType, addons: Addon[], addonProvider: AddonProvider) {
    const providerAddonIds = this.getExternalIdsForProvider(addonProvider, addons);
    if (!providerAddonIds.length) {
      return;
    }

    const searchResults = await addonProvider.getAll(clientType, providerAddonIds);
    for (let result of searchResults) {
      const addon = addons.find((addon) => addon.externalId === result?.externalId);
      const latestFile = this.getLatestFile(result, addon?.channelType);

      if (
        !result ||
        !latestFile ||
        (latestFile.version === addon.latestVersion && latestFile.releaseDate === addon.releasedAt)
      ) {
        continue;
      }

      addon.latestVersion = latestFile.version;
      addon.releasedAt = latestFile.releaseDate;
      addon.downloadUrl = latestFile.downloadUrl;
      addon.name = result.name;
      addon.author = result.author;
      addon.externalChannel = getEnumName(AddonChannelType, latestFile.channelType);

      if (latestFile.gameVersion) {
        addon.gameVersion = latestFile.gameVersion;
      }

      addon.thumbnailUrl = result.thumbnailUrl;
      addon.externalUrl = result.externalUrl;

      this._addonStorage.set(addon.id, addon);
    }
  }

  private getExternalIdsForProvider(addonProvider: AddonProvider, addons: Addon[]): string[] {
    return addons.filter((addon) => addon.providerName === addonProvider.name).map((addon) => addon.externalId);
  }

  private async scanAddons(clientType: WowClientType): Promise<Addon[]> {
    if (clientType === WowClientType.None) {
      return [];
    }

    const addonFolders = await this._warcraftService.listAddons(clientType);
    for (let provider of this._addonProviders) {
      try {
        const validFolders = addonFolders.filter((af) => !af.matchingAddon && af.toc);
        await provider.scan(clientType, this._wowUpService.getDefaultAddonChannel(clientType), validFolders);
      } catch (err) {
        console.error(err);
      }
    }

    const matchedAddonFolders = addonFolders.filter((addonFolder) => !!addonFolder.matchingAddon);
    matchedAddonFolders.forEach((maf) => this.setExternalIds(maf.matchingAddon, maf.toc));
    const matchedGroups = _.groupBy(
      matchedAddonFolders,
      (addonFolder) => `${addonFolder.matchingAddon.providerName}${addonFolder.matchingAddon.externalId}`
    );

    console.log(Object.keys(matchedGroups));

    return Object.values(matchedGroups).map(
      (value) => _.orderBy(value, (v) => v.matchingAddon.externalIds.length).reverse()[0].matchingAddon
    );
  }

  private setExternalIds(addon: Addon, toc: Toc) {
    if (!toc) {
      return;
    }

    const externalIds: AddonExternalId[] = [];
    if (toc.wowInterfaceId) {
      externalIds.push({
        id: toc.wowInterfaceId,
        providerName: ADDON_PROVIDER_WOWINTERFACE,
      });
    }

    if (toc.tukUiProjectId) {
      externalIds.push({
        id: toc.tukUiProjectId,
        providerName: ADDON_PROVIDER_TUKUI,
      });
    }

    if (toc.curseProjectId) {
      externalIds.push({
        id: toc.curseProjectId,
        providerName: ADDON_PROVIDER_CURSEFORGE,
      });
    }

    addon.externalIds = externalIds;
  }

  public async setProvider(addon: Addon, externalId: string, providerName: string, clientType: WowClientType) {
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    console.debug(`Setting new provider: ${providerName}`);
    const externalAddon = await this.getAddon(externalId, providerName, clientType).toPromise();
    if (!externalAddon) {
      throw new Error(`External addon not found: ${providerName}|${externalId}`);
    }

    console.debug("externalAdd", externalAddon);

    this.removeAddon(addon, false);

    this._addonStorage.set(externalAddon.id, externalAddon);
    this.installAddon(externalAddon.id);
  }

  public getFeaturedAddons(clientType: WowClientType): Observable<AddonSearchResult[]> {
    return forkJoin(this._addonProviders.map((p) => p.getFeaturedAddons(clientType))).pipe(
      map((results) => {
        return _.orderBy(results.flat(1), ["downloadCount"]).reverse();
      })
    );
  }

  public getByExternalId(externalId: string, clientType: WowClientType) {
    return this._addonStorage.getByExternalId(externalId, clientType);
  }

  public isInstalled(externalId: string, clientType: WowClientType) {
    return !!this.getByExternalId(externalId, clientType);
  }

  public async backfillAddons() {
    console.debug("backfillAddons");
    const clientTypes = getEnumList<WowClientType>(WowClientType).filter(
      (clientType) => clientType !== WowClientType.None
    );

    for (let clientType of clientTypes) {
      const addons = this._addonStorage.getAllForClientType(clientType);
      for (let addon of addons) {
        await this.backfillAddon(addon);
      }
    }
  }

  public async backfillAddon(addon: Addon) {
    if (addon.externalIds) {
      return;
    }

    const tocPaths = this.getTocPaths(addon);
    console.debug("tocPaths", tocPaths);
    const tocFiles = await Promise.all(_.map(tocPaths, (tocPath) => this._tocService.parse(tocPath)));
    const orderedTocFiles = _.orderBy(tocFiles, ["wowInterfaceId", "loadOnDemand"], ["desc", "asc"]);
    const primaryToc = _.first(orderedTocFiles);
    this.setExternalIds(addon, primaryToc);
    this.saveAddon(addon);
  }

  public getTocPaths(addon: Addon) {
    const addonFolderPath = this._warcraftService.getAddonFolderPath(addon.clientType);
    const installedFolders = this.getInstalledFolders(addon);

    return _.map(installedFolders, (installedFolder) =>
      path.join(addonFolderPath, installedFolder, `${installedFolder}.toc`)
    );
  }

  private getProvider(providerName: string) {
    return this._addonProviders.find((provider) => provider.name === providerName);
  }

  private getAddonProvider(addonUri: URL): AddonProvider {
    return this._addonProviders.find((provider) => provider.isValidAddonUri(addonUri));
  }

  private getLatestFile(searchResult: AddonSearchResult, channelType: AddonChannelType): AddonSearchResultFile {
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

    return {
      id: uuidv4(),
      name: searchResult.name,
      thumbnailUrl: searchResult.thumbnailUrl,
      latestVersion: latestFile.version,
      clientType: clientType,
      externalId: searchResult.externalId,
      gameVersion: latestFile.gameVersion,
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
    };
  }

  private createAddonDependency = (dependency: AddonSearchResultDependency): AddonDependency => {
    return {
      externalAddonId: dependency.externalAddonId,
      type: dependency.type,
    };
  };
}
