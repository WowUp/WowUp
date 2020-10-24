import { Injectable } from "@angular/core";
import { AddonStorageService } from "../storage/addon-storage.service";
import { Addon } from "../../entities/addon";
import { WarcraftService } from "../warcraft/warcraft.service";
import { AddonProvider } from "../../addon-providers/addon-provider";
import { CurseAddonProvider } from "../../addon-providers/curse-addon-provider";
import * as _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";
import * as fs from "fs";
import * as slug from "slug";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { AddonFolder } from "app/models/wowup/addon-folder";
import { AddonChannelType } from "app/models/wowup/addon-channel-type";
import { AddonSearchResult } from "app/models/wowup/addon-search-result";
import { AddonSearchResultFile } from "app/models/wowup/addon-search-result-file";
import { forkJoin, from, Observable, Subject } from "rxjs";
import { map, mergeMap } from "rxjs/operators";
import { AddonInstallState } from "app/models/wowup/addon-install-state";
import { DownloadSevice } from "../download/download.service";
import { WowUpService } from "../wowup/wowup.service";
import { FileService } from "../files/file.service";
import { TocService } from "../toc/toc.service";
import { AddonUpdateEvent } from "app/models/wowup/addon-update-event";
import { AddonProviderFactory } from "./addon.provider.factory";
import { AnalyticsService } from "../analytics/analytics.service";
import { getEnumName } from "app/utils/enum.utils";

interface InstallQueueItem {
  addonId: string;
  onUpdate: (
    installState: AddonInstallState,
    progress: number
  ) => void | undefined;
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
    private _downloadService: DownloadSevice,
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

    this._installQueue
      .pipe(mergeMap((item) => from(this.processInstallQueue(item)), 3))
      .subscribe((addonName) => {
        console.log("INSTALL DONE", addonName);
      });
  }

  public saveAddon(addon: Addon) {
    this._addonStorage.set(addon.id, addon);
  }

  public async search(
    query: string,
    clientType: WowClientType
  ): Promise<AddonSearchResult[]> {
    var searchTasks = this._addonProviders.map((p) =>
      p.searchByQuery(query, clientType)
    );
    var searchResults = await Promise.all(searchTasks);

    await this._analyticsService.trackUserAction(
      "addons",
      "search",
      `${clientType}|${query}`
    );

    const flatResults = searchResults.flat(1);

    return _.orderBy(flatResults, "downloadCount").reverse();
  }

  public async installPotentialAddon(
    potentialAddon: AddonSearchResult,
    clientType: WowClientType,
    onUpdate: (
      installState: AddonInstallState,
      progress: number
    ) => void = undefined
  ) {
    var existingAddon = this._addonStorage.getByExternalId(
      potentialAddon.externalId,
      clientType
    );
    if (existingAddon) {
      throw new Error("Addon already installed");
    }

    const addon = await this.getAddon(
      potentialAddon.externalId,
      potentialAddon.providerName,
      clientType
    ).toPromise();
    this._addonStorage.set(addon.id, addon);

    await this.installAddon(addon.id, onUpdate);
  }

  public async processAutoUpdates(): Promise<number> {
    const autoUpdateAddons = this.getAutoUpdateEnabledAddons();
    const clientTypeGroups = _.groupBy(
      autoUpdateAddons,
      (addon) => addon.clientType
    );
    let updateCt = 0;

    for (let clientTypeStr in clientTypeGroups) {
      const clientType: WowClientType = parseInt(clientTypeStr, 10);

      const synced = await this.syncAddons(
        clientType,
        clientTypeGroups[clientType]
      );
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
    return (
      addon.installedVersion && addon.installedVersion !== addon.latestVersion
    );
  }

  public getAutoUpdateEnabledAddons() {
    return this._addonStorage.queryAll((addon) => {
      return addon.isIgnored !== true && addon.autoUpdateEnabled;
    });
  }

  public installAddon(
    addonId: string,
    onUpdate: (
      installState: AddonInstallState,
      progress: number
    ) => void = undefined
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

  private processInstallQueue = async (
    queueItem: InstallQueueItem
  ): Promise<string> => {
    const addonId = queueItem.addonId;
    const onUpdate = queueItem.onUpdate;

    const addon = this.getAddonById(addonId);
    if (addon == null || !addon.downloadUrl) {
      throw new Error("Addon not found or invalid");
    }

    const downloadFileName = `${slug(addon.name)}.zip`;

    console.log("installAddon", addon.name);

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

      onUpdate?.call(this, AddonInstallState.Installing, 75);
      this._addonInstalledSrc.next({
        addon,
        installState: AddonInstallState.Installing,
        progress: 75,
      });

      const unzipPath = path.join(
        this._wowUpService.applicationDownloadsFolderPath,
        uuidv4()
      );

      unzippedDirectory = await this._fileService.unzipFile(
        downloadedFilePath,
        unzipPath
      );

      await this.installUnzippedDirectory(unzippedDirectory, addon.clientType);
      const unzippedDirectoryNames = await this._fileService.listDirectories(
        unzippedDirectory
      );

      addon.installedVersion = addon.latestVersion;
      addon.installedAt = new Date();
      addon.installedFolders = unzippedDirectoryNames.join(",");

      if (!!addon.gameVersion) {
        addon.gameVersion = await this.getLatestGameVersion(
          unzippedDirectory,
          unzippedDirectoryNames
        );
      }

      this._addonStorage.set(addon.id, addon);

      const actionLabel = `${getEnumName(WowClientType, addon.clientType)}|${
        addon.providerName
      }|${addon.externalId}|${addon.name}`;
      this._analyticsService.trackUserAction(
        "addons",
        "install_by_id",
        actionLabel
      );

      queueItem.completion.resolve();
    } catch (err) {
      console.error(err);
      queueItem.completion.reject(err);
    } finally {
      const unzippedDirectoryExists = await this._fileService.pathExists(
        unzippedDirectory
      );

      const downloadedFilePathExists = await this._fileService.pathExists(
        downloadedFilePath
      );

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
    const curseProvider = this._addonProviders.find(
      (p) => p.name === "Curse"
    ) as CurseAddonProvider;

    const clientTypes = await this._warcraftService.getWowClientTypes();
    for (let clientType of clientTypes) {
      const addonFolders = await this._warcraftService.listAddons(clientType);
      const scanResults = await curseProvider.getScanResults(addonFolders);
      const map = {};

      scanResults.forEach((sr) => (map[sr.folderName] = sr.fingerprint));

      console.log(
        `clientType ${this._warcraftService.getClientDisplayName(
          clientType
        )} addon fingerprints`
      );
      console.log(map);
    }
  }

  private async getLatestGameVersion(
    baseDir: string,
    installedFolders: string[]
  ) {
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

  private async installUnzippedDirectory(
    unzippedDirectory: string,
    clientType: WowClientType
  ) {
    const addonFolderPath = this._warcraftService.getAddonFolderPath(
      clientType
    );
    const unzippedFolders = await this._fileService.listDirectories(
      unzippedDirectory
    );
    for (let unzippedFolder of unzippedFolders) {
      const unzippedFilePath = path.join(unzippedDirectory, unzippedFolder);
      const unzipLocation = path.join(addonFolderPath, unzippedFolder);
      const unzipBackupLocation = path.join(
        addonFolderPath,
        `${unzippedFolder}-bak`
      );

      try {
        // If the backup dir exists for some reason, kill it.
        console.log("DELETE BKUP", unzipBackupLocation);
        await this._fileService.deleteIfExists(unzipBackupLocation);

        // If the user already has the addon installed, create a temporary backup
        if (await this._fileService.pathExists(unzipLocation)) {
          console.log("BACKING UP", unzipLocation);
          await this._fileService.copy(unzipLocation, unzipBackupLocation);
          await this._fileService.remove(unzipLocation);
        }

        // Copy contents from unzipped new directory to existing addon folder location
        console.log("COPY", unzipLocation);
        await this._fileService.copy(unzippedFilePath, unzipLocation);

        // If the copy succeeds, delete the backup
        console.log("DELETE BKUP", unzipBackupLocation);
        await this._fileService.deleteIfExists(unzipBackupLocation);
      } catch (err) {
        console.error(`Failed to copy addon directory ${unzipLocation}`);
        console.error(err);

        // If a backup directory exists, attempt to roll back
        if (fs.existsSync(unzipBackupLocation)) {
          // If the new addon folder was already created delete it
          if (fs.existsSync(unzipLocation)) {
            await this._fileService.remove(unzipLocation);
          }

          // Move the backup folder into the original location
          console.log(`Attempting to roll back ${unzipBackupLocation}`);
          await this._fileService.copy(unzipBackupLocation, unzipLocation);
        }

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

  public getAddon(
    externalId: string,
    providerName: string,
    clientType: WowClientType
  ) {
    const targetAddonChannel = this._wowUpService.getDefaultAddonChannel(
      clientType
    );
    const provider = this.getProvider(providerName);
    return provider.getById(externalId, clientType).pipe(
      map((searchResult) => {
        console.log("SEARCH RES", searchResult);
        let latestFile = this.getLatestFile(searchResult, targetAddonChannel);
        if (!latestFile) {
          latestFile = searchResult.files[0];
        }

        return this.createAddon(
          latestFile.folders[0],
          searchResult,
          latestFile,
          clientType
        );
      })
    );
  }

  public getFullInstallPath(addon: Addon) {
    const addonFolderPath = this._warcraftService.getAddonFolderPath(
      addon.clientType
    );
    return path.join(addonFolderPath, addon.folderName);
  }

  public async removeAddon(addon: Addon) {
    const installedDirectories = addon.installedFolders?.split(",") ?? [];

    const addonFolderPath = this._warcraftService.getAddonFolderPath(
      addon.clientType
    );
    for (let directory of installedDirectories) {
      const addonDirectory = path.join(addonFolderPath, directory);
      await this._fileService.remove(addonDirectory);
    }

    this._addonStorage.remove(addon);
    this._addonRemovedSrc.next(addon.id);
  }

  public async getAddons(
    clientType: WowClientType,
    rescan = false
  ): Promise<Addon[]> {
    let addons = this._addonStorage.getAllForClientType(clientType);
    if (rescan || addons.length === 0) {
      const newAddons = await this.scanAddons(clientType);
      console.log(newAddons);

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
        (ea) =>
          ea.externalId == newAddon.externalId &&
          ea.providerName == newAddon.providerName
      );

      if (!existingAddon) {
        return;
      }

      newAddon.autoUpdateEnabled = existingAddon.autoUpdateEnabled;
      newAddon.isIgnored = existingAddon.isIgnored;
      newAddon.installedAt = existingAddon.installedAt;
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

  private async syncProviderAddons(
    clientType: WowClientType,
    addons: Addon[],
    addonProvider: AddonProvider
  ) {
    const providerAddonIds = this.getExternalIdsForProvider(
      addonProvider,
      addons
    );
    if (!providerAddonIds.length) {
      return;
    }

    const searchResults = await addonProvider.getAll(
      clientType,
      providerAddonIds
    );
    for (let result of searchResults) {
      const addon = addons.find(
        (addon) => addon.externalId === result?.externalId
      );
      const latestFile = this.getLatestFile(result, addon?.channelType);

      if (
        !result ||
        !latestFile ||
        (latestFile.version === addon.latestVersion &&
          latestFile.releaseDate === addon.releasedAt)
      ) {
        continue;
      }

      addon.latestVersion = latestFile.version;
      addon.releasedAt = latestFile.releaseDate;
      addon.downloadUrl = latestFile.downloadUrl;
      addon.name = result.name;
      addon.author = result.author;

      if (latestFile.gameVersion) {
        addon.gameVersion = latestFile.gameVersion;
      }

      addon.thumbnailUrl = result.thumbnailUrl;
      addon.externalUrl = result.externalUrl;

      this._addonStorage.set(addon.id, addon);
    }
  }

  private getExternalIdsForProvider(
    addonProvider: AddonProvider,
    addons: Addon[]
  ): string[] {
    return addons
      .filter((addon) => addon.providerName === addonProvider.name)
      .map((addon) => addon.externalId);
  }

  private async scanAddons(clientType: WowClientType): Promise<Addon[]> {
    if (clientType === WowClientType.None) {
      return [];
    }

    const addonFolders = await this._warcraftService.listAddons(clientType);
    for (let provider of this._addonProviders) {
      try {
        const validFolders = addonFolders.filter(
          (af) => !af.matchingAddon && af.toc
        );
        await provider.scan(
          clientType,
          this._wowUpService.getDefaultAddonChannel(clientType),
          validFolders
        );
      } catch (err) {
        console.log(err);
      }
    }

    const matchedAddonFolders = addonFolders.filter(
      (addonFolder) => !!addonFolder.matchingAddon
    );
    const matchedGroups = _.groupBy(
      matchedAddonFolders,
      (addonFolder) =>
        `${addonFolder.matchingAddon.providerName}${addonFolder.matchingAddon.externalId}`
    );

    console.log(Object.keys(matchedGroups));

    return Object.values(matchedGroups).map((value) => value[0].matchingAddon);
  }

  public getFeaturedAddons(
    clientType: WowClientType
  ): Observable<AddonSearchResult[]> {
    return forkJoin(
      this._addonProviders.map((p) => p.getFeaturedAddons(clientType))
    ).pipe(
      map((results) => {
        return _.orderBy(results.flat(1), ["downloadCount"]).reverse();
      })
    );
  }

  public isInstalled(externalId: string, clientType: WowClientType) {
    return !!this._addonStorage.getByExternalId(externalId, clientType);
  }

  private getProvider(providerName: string) {
    return this._addonProviders.find(
      (provider) => provider.name === providerName
    );
  }

  private getAllStoredAddons(clientType: WowClientType) {
    const addons: Addon[] = [];

    this._addonStorage.query((store) => {
      for (const result of store) {
        addons.push(result[1] as Addon);
      }
    });

    return addons;
  }

  private async getLocalAddons(clientType: WowClientType): Promise<any> {
    const addonFolders = await this._warcraftService.listAddons(clientType);
    const addons: Addon[] = [];
    console.log("addonFolders", addonFolders);

    for (const folder of addonFolders) {
      try {
        let addon: Addon;

        if (folder.toc.curseProjectId) {
          addon = await this.getCurseAddonById(folder, clientType);
        } else {
        }

        if (!addon) {
          continue;
        }

        addons.push(addon);
      } catch (e) {
        console.error(e);
      }
    }

    return addons;
  }

  private getAddonProvider(addonUri: URL): AddonProvider {
    return this._addonProviders.find((provider) =>
      provider.isValidAddonUri(addonUri)
    );
  }

  private async getCurseAddonById(
    addonFolder: AddonFolder,
    clientType: WowClientType
  ) {
    const curseProvider = this._addonProviders.find(
      (p) => p instanceof CurseAddonProvider
    );
    const searchResult = await curseProvider
      .getById(addonFolder.toc.curseProjectId, clientType)
      .toPromise();
    const latestFile = this.getLatestFile(
      searchResult,
      AddonChannelType.Stable
    );
    return this.createAddon(
      addonFolder.name,
      searchResult,
      latestFile,
      clientType
    );
  }

  private getLatestFile(
    searchResult: AddonSearchResult,
    channelType: AddonChannelType
  ): AddonSearchResultFile {
    let files = _.filter(
      searchResult.files,
      (f: AddonSearchResultFile) => f.channelType <= channelType
    );
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

    return {
      id: uuidv4(),
      name: searchResult.name,
      thumbnailUrl: searchResult.thumbnailUrl,
      latestVersion: latestFile.version,
      clientType: clientType,
      externalId: searchResult.externalId,
      folderName: folderName,
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
    };
  }
}
