import { orderBy } from "lodash";
import * as path from "path";
import { Addon, AddonExternalId, getGameVersionList, Toc, WowClientType, WowInstallation } from "wowup-lib-core";

import { ADDON_PROVIDER_UNKNOWN, ADDON_PROVIDER_ZIP } from "../../../src/common/constants";
import {
  containsOwnExternalId,
  insertExternalId,
  reconcileExternalIds,
  setExternalIds,
} from "../../../src/common/addons/addon-rules";
import {
  AddExternalIdRequest,
  AddonInstallPhase,
  InstallAddonFileRequest,
  InstalledAddonFile,
  RemoveAddonRequest,
  RemovedAddons,
} from "../../../src/common/models/addon-install";
import { AddonRepository } from "./addon-repository";

/**
 * What the user chooses about an addon. The saved copy is the authority on these: the user can change
 * them while a download or an install runs, and the caller's copy is from before that.
 */
const USER_SETTING_KEYS = ["autoUpdateEnabled", "autoUpdateNotificationsEnabled", "channelType"] as const;

/** Folders a zip may carry that are never an addon */
const IGNORED_FOLDER_NAMES = ["__MACOSX"];

const BACKUP_SUFFIX = "-bak";

/** The filesystem calls an install makes, as deps so the pipeline can be tested on a fake */
export interface InstallFileSystem {
  pathExists(filePath: string): Promise<boolean>;
  listDirectories(dirPath: string): Promise<string[]>;
  /** Copy a file or a directory tree, replacing what's at the destination */
  copy(sourcePath: string, destinationPath: string): Promise<void>;
  /** Delete a file or directory tree; a path that isn't there is not an error */
  remove(filePath: string): Promise<void>;
  /** Extract a zip into `outputFolder`, creating it */
  unzip(zipFilePath: string, outputFolder: string): Promise<void>;
}

interface InstallLog {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface AddonInstallServiceDeps {
  repository: AddonRepository;
  getInstallations: () => WowInstallation[];
  getAddonFolderPath: (installation: WowInstallation) => string;
  getAllTocs: (baseDir: string, folderNames: string[], clientType: WowClientType) => Promise<Toc[]>;
  /** The only folder an install will unzip in or delete a zip from */
  downloadsFolderPath: string;
  fs: InstallFileSystem;
  newId: () => string;
  now: () => Date;
  log: InstallLog;
}

/**
 * Puts a downloaded addon on disk and keeps its saved record in step: backs up the folders the old
 * version installed, unzips and copies the new one in (restoring the backup if that fails), reads the
 * new tocs, and saves the result. Removing an addon goes through here too.
 *
 * Downloading stays with the caller, because a failed download is retried after asking the addon's
 * provider for a fresh url, and the providers still live in the renderer.
 */
export class AddonInstallService {
  public constructor(private readonly deps: AddonInstallServiceDeps) {}

  public async installFile(
    request: InstallAddonFileRequest,
    onPhase: (phase: AddonInstallPhase) => void = () => {},
  ): Promise<InstalledAddonFile> {
    this.assertInDownloadsFolder(request.zipFilePath);

    // The saved copy knows which folders are on disk now; a rescan may have changed them since the
    // caller read the addon
    const saved = this.deps.repository.getById(request.addon.id);
    const addon: Addon = saved
      ? { ...request.addon, installedFolderList: saved.installedFolderList, installedFolders: saved.installedFolders }
      : { ...request.addon };
    const unzipPath = path.join(this.deps.downloadsFolderPath, this.deps.newId());

    try {
      const installation = this.getInstallation(addon.installationId);
      const addonFolderPath = this.deps.getAddonFolderPath(installation);

      onPhase("backingUp");
      const backupFolders = await this.backupInstalledFolders(addonFolderPath, addon.installedFolderList ?? []);

      onPhase("installing");
      try {
        await this.deps.fs.unzip(request.zipFilePath, unzipPath);
        await this.copyAddonFolders(unzipPath, addonFolderPath);
      } catch (e) {
        this.logAction("RestoreBackup", addon, ...backupFolders);
        await this.restoreBackups(backupFolders);
        throw e;
      } finally {
        await this.removeAllSafe(backupFolders);
      }

      const folderNames = (await this.deps.fs.listDirectories(unzipPath)).filter(
        (name) => !IGNORED_FOLDER_NAMES.includes(name),
      );
      this.logFolderChanges(addon, folderNames);

      addon.installedExternalReleaseId = addon.externalLatestReleaseId;
      addon.installedVersion = addon.latestVersion;
      addon.installedAt = this.deps.now();
      addon.installedFolderList = folderNames;
      addon.installedFolders = folderNames.join(",");
      addon.isIgnored = request.forceIgnore;

      const tocs = await this.deps.getAllTocs(unzipPath, folderNames, addon.clientType);
      const gameVersions = getGameVersionList(tocs.flatMap((toc) => toc.interface ?? []));
      if (gameVersions.length > 0) {
        addon.gameVersion = gameVersions;
      }
      if (!addon.author) {
        addon.author = longest(tocs.map((toc) => toc.author));
      }
      // A zip has no listing to name it, so take the name from its tocs
      if (addon.providerName === ADDON_PROVIDER_ZIP) {
        addon.name = longest(tocs.map((toc) => toc.title)) ?? "";
      }

      const providerNames = new Set(request.providerNames);
      await this.addTocExternalIds(addon, addonFolderPath, installation.clientType, providerNames);
      if (request.originalAddon) {
        reconcileExternalIds(addon, request.originalAddon, providerNames);
      }

      // Read again with nothing awaited before the save, so a change made during the install is kept
      const latest = this.deps.repository.getById(addon.id);
      if (latest) {
        for (const key of USER_SETTING_KEYS) {
          (addon as unknown as Record<string, unknown>)[key] = latest[key];
        }
      }
      this.deps.repository.saveAll([addon]);

      const removedAddons = this.removeUnknownOwnersOf(addon);

      return { addon, removedAddons };
    } finally {
      await this.removeAllSafe([unzipPath, request.zipFilePath]);
    }
  }

  /**
   * Record another provider's id for an installed addon, unless it's already there or that provider
   * couldn't have issued it. Changes only that field of the saved copy.
   *
   * @returns the addon's external ids after the change, or undefined when the addon isn't saved
   */
  public addExternalId(request: AddExternalIdRequest): AddonExternalId[] | undefined {
    const addon = this.deps.repository.getById(request.addonId);
    if (!addon) {
      return undefined;
    }

    addon.externalIds = addon.externalIds ?? [];
    insertExternalId(addon.externalIds, request.providerName, new Set([request.providerName]), request.externalId);
    this.deps.repository.saveAll([addon]);
    return addon.externalIds;
  }

  public async removeAddon(request: RemoveAddonRequest): Promise<RemovedAddons> {
    const addon = this.deps.repository.getById(request.addon.id) ?? request.addon;
    const removedAddons: Addon[] = [];

    if (!(await this.removeOne(addon, request.removeDirectories))) {
      return { removedAddons };
    }
    removedAddons.push(addon);

    if (request.removeDependencies) {
      for (const dependency of this.findDependencies(addon)) {
        try {
          if (await this.removeOne(dependency, true)) {
            removedAddons.push(dependency);
          }
        } catch (e) {
          this.deps.log.error(`Failed to remove dependency ${dependency.name} of ${addon.name}`, e);
        }
      }
    }

    return { removedAddons };
  }

  /** @returns false when the addon was left alone because its installation is gone */
  private async removeOne(addon: Addon, removeDirectories: boolean): Promise<boolean> {
    this.deps.log.info(`[RemoveAddon] ${addon.providerName ?? ""} ${addon.externalId ?? "NO_EXT_ID"} ${addon.name}`);

    const folderNames = addon.installedFolderList ?? [];
    if (removeDirectories && folderNames.length > 0) {
      const installation = this.deps.getInstallations().find((inst) => inst.id === addon.installationId);
      if (!installation) {
        this.deps.log.warn("No installation found for remove", addon.installationId);
        return false;
      }

      const addonFolderPath = this.deps.getAddonFolderPath(installation);
      let failures = 0;
      for (const folderName of folderNames) {
        const folderPath = path.join(addonFolderPath, folderName);
        this.deps.log.info(
          `[RemoveAddonDirectory] ${addon.providerName ?? ""} ${addon.externalId ?? "NO_EXT_ID"} ${folderPath}`,
        );
        try {
          await this.deps.fs.remove(folderPath);
        } catch (e) {
          this.deps.log.error(e);
          failures += 1;
        }
      }

      if (failures === folderNames.length) {
        throw new Error("Failed to remove all directories");
      }
    }

    this.deps.repository.removeById(addon.id);
    return true;
  }

  private findDependencies(addon: Addon): Addon[] {
    if (!addon.providerName || !addon.installationId) {
      return [];
    }

    const dependencies: Addon[] = [];
    for (const dependency of addon.dependencies ?? []) {
      if (!dependency.externalAddonId) {
        continue;
      }

      const dependencyAddon = this.deps.repository.getByExternalId(
        dependency.externalAddonId,
        addon.providerName,
        addon.installationId,
      );
      if (dependencyAddon) {
        dependencies.push(dependencyAddon);
      } else {
        this.deps.log.info(`${addon.name}: Dependency not found ${dependency.externalAddonId}`);
      }
    }
    return dependencies;
  }

  /** The zip path comes from the renderer, and main deletes it afterwards */
  private assertInDownloadsFolder(zipFilePath: string): void {
    const downloads = path.resolve(this.deps.downloadsFolderPath) + path.sep;
    if (!path.resolve(zipFilePath).startsWith(downloads)) {
      throw new Error(`Addon zip is not in the downloads folder: ${zipFilePath}`);
    }
  }

  private getInstallation(installationId: string | undefined): WowInstallation {
    const installation = this.deps.getInstallations().find((inst) => inst.id === installationId);
    if (!installation) {
      throw new Error(`Installation not found: ${installationId ?? ""}`);
    }
    return installation;
  }

  /**
   * Move each installed folder aside so a failed install can be undone. Copied then deleted rather
   * than renamed: a rename fails while the game or an editor holds a file in the folder open.
   */
  private async backupInstalledFolders(addonFolderPath: string, folderNames: string[]): Promise<string[]> {
    const backupFolders: string[] = [];
    for (const folderName of folderNames) {
      const folderPath = path.join(addonFolderPath, folderName);
      const backupPath = `${folderPath}${BACKUP_SUFFIX}`;

      await this.deps.fs.remove(backupPath);
      if (await this.deps.fs.pathExists(folderPath)) {
        await this.deps.fs.copy(folderPath, backupPath);
        await this.deps.fs.remove(folderPath);
        backupFolders.push(backupPath);
      }
    }
    return backupFolders;
  }

  private async copyAddonFolders(unzipPath: string, addonFolderPath: string): Promise<void> {
    for (const folderName of await this.deps.fs.listDirectories(unzipPath)) {
      if (IGNORED_FOLDER_NAMES.includes(folderName)) {
        continue;
      }

      const destination = path.join(addonFolderPath, folderName);
      try {
        await this.deps.fs.copy(path.join(unzipPath, folderName), destination);
      } catch (e) {
        this.deps.log.error(`Failed to copy addon directory ${destination}`);
        throw e;
      }
    }
  }

  private async restoreBackups(backupFolders: string[]): Promise<void> {
    try {
      for (const backupPath of backupFolders) {
        if (!(await this.deps.fs.pathExists(backupPath))) {
          continue;
        }

        const originalPath = backupPath.substring(0, backupPath.length - BACKUP_SUFFIX.length);
        await this.deps.fs.remove(originalPath);
        await this.deps.fs.copy(backupPath, originalPath);
      }
    } catch (e) {
      this.deps.log.error("Failed to roll back directories", backupFolders, e);
    }
  }

  /** Collect the provider ids the installed tocs name, unless the addon already has its own */
  private async addTocExternalIds(
    addon: Addon,
    addonFolderPath: string,
    clientType: WowClientType,
    providerNames: ReadonlySet<string>,
  ): Promise<void> {
    if (addon.externalIds && containsOwnExternalId(addon)) {
      return;
    }

    try {
      const tocs = await this.deps.getAllTocs(addonFolderPath, addon.installedFolderList ?? [], clientType);
      // The toc carrying a WoWInterface id is the one most likely to carry the others too
      const primaryToc = orderBy(tocs, ["wowInterfaceId", "loadOnDemand"], ["desc", "asc"])[0];
      if (!primaryToc) {
        throw new Error("Could not find primary toc");
      }

      setExternalIds(addon, primaryToc, providerNames);
    } catch (e) {
      this.deps.log.error(e);
    }
  }

  /** Unknown addons left on folders this addon now owns are stale: a rescan found them before it */
  private removeUnknownOwnersOf(addon: Addon): Addon[] {
    if (!addon.installationId) {
      return [];
    }

    const folderNames = new Set(addon.installedFolderList ?? []);
    const stale = this.deps.repository
      .getAllForInstallation(addon.installationId)
      .filter(
        (other) =>
          other.id !== addon.id &&
          other.providerName === ADDON_PROVIDER_UNKNOWN &&
          (other.installedFolderList ?? []).some((name) => folderNames.has(name)),
      );

    for (const other of stale) {
      this.deps.log.info(`[RemoveAddon] ${other.providerName ?? ""} NO_EXT_ID ${other.name}`);
      this.deps.repository.removeById(other.id);
    }
    return stale;
  }

  private logFolderChanges(addon: Addon, folderNames: string[]): void {
    const existing = addon.installedFolderList ?? [];
    const added = folderNames.filter((name) => !existing.includes(name));
    const removed = existing.filter((name) => !folderNames.includes(name));

    if (existing.length > 0) {
      this.logAction("AddedDirs", addon, ...added);
    }
    if (removed.length > 0) {
      this.logAction("DiffDirs", addon, ...removed);
    }
  }

  private logAction(action: string, addon: Addon, ...extras: string[]): void {
    this.deps.log.info(
      `[${action}] ${addon.providerName ?? ""} ${addon.externalId ?? "NO_EXT_ID"} ${addon.name} ${extras.join(" ")}`,
    );
  }

  private async removeAllSafe(paths: string[]): Promise<void> {
    for (const filePath of paths) {
      try {
        await this.deps.fs.remove(filePath);
      } catch (e) {
        this.deps.log.error(`Failed to remove ${filePath}`, e);
      }
    }
  }
}

/** The longest non-empty value, as the best guess among several tocs' answers */
function longest(values: Array<string | undefined>): string | undefined {
  let best: string | undefined;
  for (const value of values) {
    if (value && value.length > (best?.length ?? 0)) {
      best = value;
    }
  }
  return best;
}
