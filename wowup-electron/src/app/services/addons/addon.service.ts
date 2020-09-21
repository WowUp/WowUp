import { Injectable } from "@angular/core";
import { AddonStorageService } from "../storage/addon-storage.service";
import { Addon } from "../../entities/addon";
import { WarcraftService } from "../warcraft/warcraft.service";
import { AddonProvider } from "../../addon-providers/addon-provider";
import { CurseAddonProvider } from "../../addon-providers/curse-addon-provider";
import { HttpClient } from "@angular/common/http";
import * as _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { WowUpApiService } from "../wowup-api/wowup-api.service";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { PotentialAddon } from "app/models/wowup/potential-addon";
import { AddonFolder } from "app/models/wowup/addon-folder";
import { AddonChannelType } from "app/models/wowup/addon-channel-type";
import { AddonSearchResult } from "app/models/wowup/addon-search-result";
import { AddonSearchResultFile } from "app/models/wowup/addon-search-result-file";
import { forkJoin, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { CachingService } from "../caching/caching-service";
import { AddonInstallState } from "app/models/wowup/addon-install-state";
import { DownloadSevice } from "../download/download.service";
import { WowUpService } from "../wowup/wowup.service";
import { FileService } from "../files/file.service";
import { TocService } from "../toc/toc.service";
import { ElectronService } from "../electron/electron.service";
import { TukUiAddonProvider } from "app/addon-providers/tukui-addon-provider";

@Injectable({
  providedIn: 'root'
})
export class AddonService {

  private readonly _addonProviders: AddonProvider[];

  constructor(
    private _addonStorage: AddonStorageService,
    private _cachingService: CachingService,
    private _warcraftService: WarcraftService,
    private _wowUpService: WowUpService,
    private _wowupApiService: WowUpApiService,
    private _downloadService: DownloadSevice,
    private _electronService: ElectronService,
    private _fileService: FileService,
    private _tocService: TocService,
    httpClient: HttpClient
  ) {
    this._addonProviders = [
      new TukUiAddonProvider(httpClient, this._cachingService, this._electronService, this._fileService),
      new CurseAddonProvider(httpClient, this._cachingService, this._electronService, this._fileService),
    ];
  }

  public async installPotentialAddon(
    potentialAddon: PotentialAddon,
    clientType: WowClientType,
    onUpdate: (installState: AddonInstallState, progress: number) => void
  ) {
    var existingAddon = this._addonStorage.getByExternalId(potentialAddon.externalId, clientType);
    if (existingAddon) {
      throw new Error('Addon already installed');
    }

    const addon = await this.getAddon(potentialAddon.externalId, potentialAddon.providerName, clientType).toPromise();
    this._addonStorage.set(addon.id, addon);
    await this.installAddon(addon.id, onUpdate);
  }

  public async installAddon(addonId: string, onUpdate: (installState: AddonInstallState, progress: number) => void) {
    const addon = this.getAddonById(addonId);
    if (addon == null || !addon.downloadUrl) {
      throw new Error("Addon not found or invalid");
    }

    onUpdate?.call(this, AddonInstallState.Downloading, 25);

    let downloadedFilePath = '';
    let unzippedDirectory = '';
    let downloadedThumbnail = '';
    try {
      downloadedFilePath = await this._downloadService.downloadZipFile(addon.downloadUrl, this._wowUpService.applicationDownloadsFolderPath);

      onUpdate?.call(this, AddonInstallState.Installing, 75);

      const unzipPath = path.join(this._wowUpService.applicationDownloadsFolderPath, uuidv4());
      unzippedDirectory = await this._downloadService.unzipFile(downloadedFilePath, unzipPath);

      await this.installUnzippedDirectory(unzippedDirectory, addon.clientType);
      const unzippedDirectoryNames = this._fileService.listDirectories(unzippedDirectory);

      addon.installedVersion = addon.latestVersion;
      addon.installedAt = new Date();
      addon.installedFolders = unzippedDirectoryNames.join(',');

      if (!!addon.gameVersion) {
        addon.gameVersion = await this.getLatestGameVersion(unzippedDirectory, unzippedDirectoryNames);
      }

      this._addonStorage.set(addon.id, addon);

      // await _analyticsService.TrackUserAction("Addons", "InstallById", $"{addon.ClientType}|{addon.Name}");

      // TODO update listeners
    } catch (err) {
      console.error(err);

      // TODO track error
    } finally {
      if (fs.existsSync(unzippedDirectory)) {
        await this._fileService.deleteDirectory(unzippedDirectory);
      }

      if (fs.existsSync(downloadedFilePath)) {
        fs.unlinkSync(downloadedFilePath);
      }
    }

    onUpdate(AddonInstallState.Complete, 100);
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

    return _.orderBy(versions)[0] || '';
  }

  private async installUnzippedDirectory(unzippedDirectory: string, clientType: WowClientType) {
    const addonFolderPath = this._warcraftService.getAddonFolderPath(clientType);
    const unzippedFolders = this._fileService.listDirectories(unzippedDirectory);
    for (let unzippedFolder of unzippedFolders) {
      const unzippedFilePath = path.join(unzippedDirectory, unzippedFolder);
      const unzipLocation = path.join(addonFolderPath, unzippedFolder);
      const unzipBackupLocation = path.join(addonFolderPath, `${unzippedFolder}-bak`);

      try {
        // If the user already has the addon installed, create a temporary backup
        if (fs.existsSync(unzipLocation)) {
          console.log('BACKING UP', unzipLocation);
          await this._fileService.renameDirectory(unzipLocation, unzipBackupLocation);
        }

        // Copy contents from unzipped new directory to existing addon folder location
        console.log('COPY', unzipLocation);
        await this._fileService.copyDirectory(unzippedFilePath, unzipLocation);

        // If the copy succeeds, delete the backup
        if (fs.existsSync(unzipBackupLocation)) {
        console.log('DELETE BKUP', unzipLocation);
        await this._fileService.deleteDirectory(unzipBackupLocation);
        }
      } catch (err) {
        console.error(`Failed to copy addon directory ${unzipLocation}`);
        console.error(err);

        // If a backup directory exists, attempt to roll back
        if (fs.existsSync(unzipBackupLocation)) {
          // If the new addon folder was already created delete it
          if (fs.existsSync(unzipLocation)) {
            await this._fileService.deleteDirectory(unzipLocation);
          }

          // Move the backup folder into the original location
          console.log(`Attempting to roll back ${unzipBackupLocation}`);
          await this._fileService.copyDirectory(unzipBackupLocation, unzipLocation);
        }

        throw err;
      }
    }
  }

  public getAddonById(addonId: string) {
    return this._addonStorage.get(addonId);
  }

  public getAddon(externalId: string, providerName: string, clientType: WowClientType) {
    const targetAddonChannel = AddonChannelType.Stable; // TOOD _wowUpService.GetClientAddonChannelType(clientType);
    const provider = this.getProvider(providerName);
    return provider.getById(externalId, clientType)
      .pipe(
        map(searchResult => {
          console.log('SEARCH RES', searchResult);
          let latestFile = this.getLatestFile(searchResult, targetAddonChannel);
          if (!latestFile) {
            latestFile = searchResult.files[0];
          }

          return this.createAddon(latestFile.folders[0], searchResult, latestFile, clientType);
        })
      )
  }

  public async getAddons(clientType: WowClientType, rescan = false): Promise<Addon[]> {
    let addons = this._addonStorage.getAllForClientType(clientType);
    if (rescan || !addons.length) {
      this._addonStorage.removeForClientType(clientType);
      addons = await this.scanAddons(clientType);
      this._addonStorage.setAll(addons);
    }
    //     RemoveAddons(clientType);
    //     addons = await GetLocalAddons(clientType);
    //     SaveAddons(addons);
    // }

    // await SyncAddons(clientType, addons);

    // return addons;
    return addons;
  }

  private async scanAddons(clientType: WowClientType): Promise<Addon[]> {
    const addonFolders = await this._warcraftService.listAddons(clientType);
    for (let provider of this._addonProviders) {
      try {
        const validFolders = addonFolders.filter(af => !af.matchingAddon && af.toc)
        await provider.scan(clientType, AddonChannelType.Stable, validFolders);
      } catch (err) {
        console.log(err);
      }
    }

    const matchedAddonFolders = addonFolders.filter(addonFolder => !!addonFolder.matchingAddon);
    const matchedGroups = _.groupBy(matchedAddonFolders, addonFolder => `${addonFolder.matchingAddon.providerName}${addonFolder.matchingAddon.externalId}`);

    console.log(matchedGroups);
    return Object.values(matchedGroups).map(value => value[0].matchingAddon);
  }

  public getFeaturedAddons(clientType: WowClientType): Observable<PotentialAddon[]> {
    return forkJoin(this._addonProviders.map(p => p.getFeaturedAddons(clientType)))
      .pipe(
        map(results => {
          return results.flat(1);
        })
      );
  }

  public isInstalled(externalId: string, clientType: WowClientType) {
    return !!this._addonStorage.getByExternalId(externalId, clientType);
  }

  private getProvider(providerName: string) {
    return this._addonProviders.find(provider => provider.name === providerName);
  }

  private getAllStoredAddons(clientType: WowClientType) {
    const addons: Addon[] = [];

    this._addonStorage.query(store => {
      for (const result of store) {
        addons.push(result[1] as Addon);
      }
    })

    return addons;
  }

  private async getLocalAddons(clientType: WowClientType): Promise<any> {
    const addonFolders = await this._warcraftService.listAddons(clientType);
    const addons: Addon[] = [];
    console.log('addonFolders', addonFolders);

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

  private async getCurseAddonById(
    addonFolder: AddonFolder,
    clientType: WowClientType
  ) {
    const curseProvider = this._addonProviders.find(p => p instanceof CurseAddonProvider);
    const searchResult = await curseProvider.getById(addonFolder.toc.curseProjectId, clientType).toPromise();
    const latestFile = this.getLatestFile(searchResult, AddonChannelType.Stable);
    return this.createAddon(addonFolder.name, searchResult, latestFile, clientType);
  }

  private getLatestFile(searchResult: AddonSearchResult, channelType: AddonChannelType): AddonSearchResultFile {
    return _.flow(
      _.filter((f: AddonSearchResultFile) => f.channelType <= channelType),
      _.first
    )(searchResult.files);
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
      channelType: AddonChannelType.Stable,
      isIgnored: false,
      autoUpdateEnabled: false,
    };
  }
}