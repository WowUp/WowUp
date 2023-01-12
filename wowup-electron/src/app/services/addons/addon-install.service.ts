import * as _ from "lodash";
import { Injectable } from "@angular/core";
import { from, mergeMap, Subject } from "rxjs";
import slug from "slug";
import { join as pathJoin } from "path";
import { Addon, AddonExternalId, Toc, WowClientType } from "wowup-lib-core";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { capitalizeString } from "../../utils/string.utils";
import { DownloadOptions, DownloadService } from "../download/download.service";
import { WarcraftInstallationService } from "../warcraft/warcraft-installation.service";
import { WarcraftService } from "../warcraft/warcraft.service";
import { WowUpService } from "../wowup/wowup.service";
import { AddonProviderFactory } from "./addon.provider.factory";
import { nanoid } from "nanoid";
import { FileService } from "../files/file.service";
import { WowInstallation } from "wowup-lib-core/lib/models";
import { TocService } from "../toc/toc.service";
import * as AddonUtils from "../../utils/addon.utils";
import {
  ADDON_PROVIDER_RAIDERIO,
  ADDON_PROVIDER_TUKUI,
  ADDON_PROVIDER_UNKNOWN,
  ADDON_PROVIDER_WAGO,
  ADDON_PROVIDER_WOWINTERFACE,
  ADDON_PROVIDER_WOWUP_COMPANION,
  ADDON_PROVIDER_ZIP,
  USER_ACTION_ADDON_INSTALL,
} from "../../../common/constants";
import { AddonStorageService } from "../storage/addon-storage.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { getEnumName } from "wowup-lib-core/lib/utils";

export type InstallType = "install" | "update" | "remove";

export interface InstallQueueItem {
  addon: Addon;
  onUpdate: (installState: AddonInstallState, progress: number) => void | undefined;
  completion: any;
  originalAddon?: Addon;
  installType: InstallType;
}

const IGNORED_FOLDER_NAMES = ["__MACOSX"];

const ADDON_PROVIDER_TOC_EXTERNAL_ID_MAP = {
  [ADDON_PROVIDER_WOWINTERFACE]: "wowInterfaceId",
  [ADDON_PROVIDER_TUKUI]: "tukUiProjectId",
  [ADDON_PROVIDER_WAGO]: "wagoAddonId",
};

@Injectable({
  providedIn: "root",
})
export class AddonInstallService {
  private readonly _installQueue = new Subject<InstallQueueItem>();
  private readonly _installErrorSrc = new Subject<Error>();
  private readonly _addonInstalledSrc = new Subject<AddonUpdateEvent>();
  private readonly _addonRemovedSrc = new Subject<string>();

  public readonly addonInstalled$ = this._addonInstalledSrc.asObservable();
  public readonly installError$ = this._installErrorSrc.asObservable();

  public constructor(
    private _warcraftInstallationService: WarcraftInstallationService,
    private _addonProviderService: AddonProviderFactory,
    private _wowUpService: WowUpService,
    private _warcraftService: WarcraftService,
    private _downloadService: DownloadService,
    private _fileService: FileService,
    private _tocService: TocService,
    private _addonStorage: AddonStorageService,
    private _analyticsService: AnalyticsService
  ) {
    // Setup our install queue pump here
    this._installQueue.pipe(mergeMap((item) => from(this.processInstallQueue(item)), 3)).subscribe({
      next: (addonName) => {
        console.log("Install complete", addonName);
      },
      error: (error: Error) => {
        console.error(error);
        this._installErrorSrc.next(error);
      },
    });
  }

  public enqueue(queueItem: InstallQueueItem): void {
    this._installQueue.next(queueItem);
  }

  private processInstallQueue = async (queueItem: InstallQueueItem): Promise<string> => {
    const onUpdate = queueItem.onUpdate;

    const addon = queueItem.addon;

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
      const downloadAuth = await addonProvider.getDownloadAuth();

      const downloadOptions: DownloadOptions = {
        fileName: downloadFileName,
        outputFolder: this._wowUpService.applicationDownloadsFolderPath,
        url: addon.downloadUrl ?? "",
        auth: downloadAuth,
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

      const unzipPath = pathJoin(this._wowUpService.applicationDownloadsFolderPath, nanoid());

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

      //   await this.installDependencies(addon, onUpdate);

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

  private logAddonAction(action: string, addon: Addon, ...extras: string[]) {
    console.log(
      `[${action}] ${addon.providerName ?? ""} ${addon.externalId ?? "NO_EXT_ID"} ${addon.name} ${extras.join(" ")}`
    );
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
      const currentAddonLocation = pathJoin(addonFolderPath, addonFolder);
      const addonFolderBackupLocation = pathJoin(addonFolderPath, `${addonFolder}-bak`);

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

  private async installUnzippedDirectory(unzippedDirectory: string, installation: WowInstallation) {
    const addonFolderPath = this._warcraftService.getAddonFolderPath(installation);
    const unzippedFolders = await this._fileService.listDirectories(unzippedDirectory);
    for (const unzippedFolder of unzippedFolders) {
      if (IGNORED_FOLDER_NAMES.includes(unzippedFolder)) {
        continue;
      }
      const unzippedFilePath = pathJoin(unzippedDirectory, unzippedFolder);
      const unzipLocation = pathJoin(addonFolderPath, unzippedFolder);

      try {
        // Copy contents from unzipped new directory to existing addon folder location
        await this._fileService.copy(unzippedFilePath, unzipLocation);
      } catch (err) {
        console.error(`Failed to copy addon directory ${unzipLocation}`);
        throw err;
      }
    }
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

  private getLatestGameVersion(tocs: Toc[]) {
    const versions = tocs.map((toc) => +toc.interface);
    const ordered = _.orderBy(versions, [], "desc");
    return AddonUtils.getGameVersion(ordered[0]?.toString() || "");
  }

  private getBestGuessTitle(tocs: Toc[]) {
    const titles = tocs.map((toc) => toc.title).filter((title) => !!title);
    return _.maxBy(titles, (title) => title?.length ?? 0) ?? "";
  }

  private getBestGuessAuthor(tocs: Toc[]) {
    const authors = tocs.map((toc) => toc.author).filter((author) => !!author);
    return _.maxBy(authors, (author) => author?.length ?? 0);
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
      addon.installedFolderList ?? [],
      installation.clientType
    );

    const tocPaths = addonTocs.map((toc) => toc.filePath);
    return tocPaths;
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

  public async saveAddon(addon: Addon | undefined): Promise<void> {
    if (!addon) {
      throw new Error("Invalid addon");
    }

    await this._addonStorage.setAsync(addon.id, addon);
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

  public async getAddons(installation: WowInstallation): Promise<Addon[]> {
    const addons = await this._addonStorage.getAllForInstallationIdAsync(installation.id);
    return addons;
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
        const addonDirectory = pathJoin(addonFolderPath, directory);
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

    if (typeof addon.id === "string") {
      this._addonRemovedSrc.next(addon.id);
    }

    if (removeDependencies) {
      await this.removeDependencies(addon);
    }

    this.trackInstallAction("remove", addon);
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

  public async getByExternalId(
    externalId: string,
    providerName: string,
    installationId: string
  ): Promise<Addon | undefined> {
    return await this._addonStorage.getByExternalIdAsync(externalId, providerName, installationId);
  }

  //   public async installDependencies(
  //     addon: Addon,
  //     onUpdate: (installState: AddonInstallState, progress: number) => void = () => {}
  //   ): Promise<void> {
  //     if (!addon.dependencies || !addon.providerName || !addon.installationId) {
  //       console.warn(`Invalid addon: ${addon.id ?? ""}`);
  //       return;
  //     }

  //     const requiredDependencies = this.getRequiredDependencies(addon);
  //     if (!requiredDependencies.length) {
  //       console.log(`${addon.name}: No required dependencies found`);
  //       return;
  //     }

  //     const maxCt = requiredDependencies.length;
  //     let currentCt = 0;
  //     for (const dependency of requiredDependencies) {
  //       currentCt += 1;
  //       const percent = (currentCt / maxCt) * 100;

  //       onUpdate?.call(this, AddonInstallState.Installing, percent);

  //       // If the dependency is already installed, skip it
  //       const existingAddon = await this.getByExternalId(
  //         dependency.externalAddonId,
  //         addon.providerName,
  //         addon.installationId
  //       );
  //       if (existingAddon) {
  //         continue;
  //       }

  //       const installation = this._warcraftInstallationService.getWowInstallation(addon.installationId);
  //       if (!installation) {
  //         throw new Error("Installation not found");
  //       }

  //       const dependencyAddon = await this.getAddon(
  //         dependency.externalAddonId,
  //         addon.providerName,
  //         installation
  //       ).toPromise();

  //       if (!dependencyAddon || !dependencyAddon.id) {
  //         console.warn(
  //           `No addon was found EID: ${dependency.externalAddonId} CP: ${addon.providerName ?? ""} CT: ${
  //             addon.clientType
  //           }`
  //         );
  //         continue;
  //       }

  //       await this._addonStorage.setAsync(dependencyAddon.id, dependencyAddon);

  //       await this.installAddon(dependencyAddon);
  //     }
  //   }
}
