import * as _ from "lodash";

import * as path from "path";
import { BehaviorSubject, firstValueFrom, forkJoin, from, Observable, of, Subject } from "rxjs";
import { catchError, distinctUntilChanged, filter, first, map, switchMap, tap } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";

import { Injectable } from "@angular/core";

import {
  ADDON_PROVIDER_CURSEFORGE,
  ADDON_PROVIDER_HUB,
  ADDON_PROVIDER_HUB_LEGACY,
  ADDON_PROVIDER_UNKNOWN,
  ERROR_ADDON_ALREADY_INSTALLED,
  USER_ACTION_ADDON_INSTALL,
  USER_ACTION_ADDON_PROTOCOL_SEARCH,
  USER_ACTION_ADDON_SEARCH,
  USER_ACTION_BROWSE_CATEGORY,
} from "../../../common/constants";

import { AddonScanError, AddonSyncError, GenericProviderError } from "../../errors";

import { AddonInstallState } from "../../models/wowup/addon-install-state";

import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { AddonVersionMismatch, AutoUpdateResult } from "../../models/wowup/addon-version-mismatch";

import * as AddonUtils from "../../utils/addon.utils";
import { getEnumName, getGameVersionList, WowInstallation, WowUpAddonProvider } from "wowup-lib-core";
import * as SearchResults from "../../utils/search-result.utils";

import { AnalyticsService } from "../analytics/analytics.service";

import { FileService } from "../files/file.service";
import { AddonStorageService } from "../storage/addon-storage.service";
import { TocService } from "../toc/toc.service";
import { WarcraftInstallationService } from "../warcraft/warcraft-installation.service";
import { WarcraftService } from "../warcraft/warcraft.service";
import { WowUpService } from "../wowup/wowup.service";
import { AddonProviderFactory } from "./addon.provider.factory";
import { AddonSyncApiService } from "../api/addon-sync-api.service";
import { containsOwnExternalId, setExternalIds } from "../../../common/addons/addon-rules";
import { AddonSyncFailure } from "../../../common/models/addon-scan";
import { CurseAddonProvider } from "../../addon-providers/curse-addon-provider";
import {
  Addon,
  AddonCategory,
  AddonChannelType,
  AddonDependency,
  AddonDependencyType,
  AddonFolder,
  AddonProvider,
  AddonSearchResult,
  AddonSearchResultDependency,
  AddonSearchResultFile,
  ProtocolSearchResult,
  SearchByUrlResult,
  WowClientType,
} from "wowup-lib-core";
import { AddonInstallService, InstallQueueItem, InstallType } from "./addon-install.service";
import { delayMs } from "../../utils/time.utils";

export interface AddonDependencyDetail {
  externalAddonId: string;
  name: string;
  installed: boolean;
}

export enum DependencyInstallState {
  Resolving,
  Installing,
  Complete,
}

/** Progress of the required dependencies an addon install pulled in, the addon is the parent */
export interface DependencyInstallEvent {
  addon: Addon;
  state: DependencyInstallState;
  total: number;
  completed: number;
}

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

export type AddonActionType = "scan" | "sync";
export interface AddonActionEvent {
  type: AddonActionType;
  addon?: Addon;
}

const IGNORED_FOLDER_NAMES = ["__MACOSX"];

/** What an addon keeps of the installed files when it is linked to a provider without reinstalling it */
type InstalledFileField = "installedVersion" | "installedAt" | "installedFolders" | "installedFolderList";
type InstalledFiles = Pick<Addon, InstalledFileField | "isLoadOnDemand">;

/** How a scan is limited and whether it saves, see scanAddons */
interface ScanOptions {
  save?: boolean;
  folderNames?: string[];
  folderFilter?: (addonFolder: AddonFolder) => boolean;
  quiet?: boolean;
}

@Injectable({
  providedIn: "root",
})
export class AddonService {
  private readonly _addonActionSrc = new Subject<AddonActionEvent>();

  private readonly _addonRemovedSrc = new Subject<string>();
  private readonly _scanUpdateSrc = new BehaviorSubject<ScanUpdate>({ type: ScanUpdateType.Unknown });

  private readonly _syncErrorSrc = new Subject<AddonSyncError>();
  private readonly _scanErrorSrc = new Subject<AddonScanError>();
  private readonly _searchErrorSrc = new Subject<GenericProviderError>();

  private readonly _anyUpdatesAvailableSrc = new BehaviorSubject<boolean>(false);
  private readonly _addonProviderChangeSrc = new Subject<AddonProvider>();
  private readonly _syncingSrc = new BehaviorSubject<boolean>(false);

  private _activeInstalls: AddonUpdateEvent[] = [];
  /** installationId|providerName|externalId of each dependency being installed right now */
  private readonly _pendingDependencyInstalls = new Set<string>();
  /** Dependency progress of each parent addon whose dependencies are still being installed, by addon id */
  private readonly _activeDependencyInstalls = new Map<string, DependencyInstallEvent>();
  private readonly _dependencyInstallSrc = new Subject<DependencyInstallEvent>();
  private readonly _installingSrc = new BehaviorSubject<boolean>(false);
  /** Rescan running right now for each installation, by installation id */
  private readonly _activeRescans = new Map<string, Promise<Addon[]>>();
  /** Rescan waiting for the running one to finish, by installation id */
  private readonly _queuedRescans = new Map<string, Promise<Addon[]>>();

  public readonly addonAction$ = this._addonActionSrc.asObservable();
  public readonly addonInstalled$ = this._addonInstallService.addonInstalled$;
  public readonly addonRemoved$ = this._addonRemovedSrc.asObservable();
  public readonly scanUpdate$ = this._scanUpdateSrc.asObservable();
  public readonly installError$ = this._addonInstallService.installError$;
  public readonly syncError$ = this._syncErrorSrc.asObservable();
  public readonly scanError$ = this._scanErrorSrc.asObservable();
  public readonly searchError$ = this._searchErrorSrc.asObservable();
  public readonly anyUpdatesAvailable$ = this._anyUpdatesAvailableSrc.asObservable();
  public readonly addonProviderChange$ = this._addonProviderChangeSrc.asObservable();
  public readonly syncing$ = this._syncingSrc.asObservable();
  public readonly dependencyInstall$ = this._dependencyInstallSrc.asObservable();
  /** True while any install, or the dependencies one pulled in, is still running */
  public readonly installing$ = this._installingSrc.pipe(distinctUntilChanged());

  public constructor(
    private _addonStorage: AddonStorageService,
    private _addonInstallService: AddonInstallService,
    private _analyticsService: AnalyticsService,
    private _warcraftService: WarcraftService,
    private _wowUpService: WowUpService,

    private _fileService: FileService,
    private _tocService: TocService,
    private _warcraftInstallationService: WarcraftInstallationService,
    private _addonProviderService: AddonProviderFactory,
    private _addonSyncApiService: AddonSyncApiService,
  ) {
    // This should keep the current update queue state snapshot up to date
    this.addonInstalled$
      .pipe(
        tap(() => {
          from(this.areAnyAddonsAvailableForUpdate())
            .pipe(first())
            .subscribe((updatesAvailable) => {
              this._anyUpdatesAvailableSrc.next(updatesAvailable);
            });
        }),
      )
      .subscribe(this.updateActiveInstall);

    this.addonRemoved$
      .pipe(switchMap(() => from(this.areAnyAddonsAvailableForUpdate())))
      .subscribe((updatesAvailable) => {
        this._anyUpdatesAvailableSrc.next(updatesAvailable);
      });

    this.scanUpdate$
      .pipe(switchMap(() => from(this.areAnyAddonsAvailableForUpdate())))
      .subscribe((updatesAvailable) => {
        this._anyUpdatesAvailableSrc.next(updatesAvailable);
      });

    // Attempt to remove addons for clients that were lost
    this._warcraftInstallationService.wowInstallations$
      .pipe(
        filter((installations) => installations.length > 0),
        switchMap((clientTypes) => from(this.reconcileOrphanAddons(clientTypes))),
        catchError((e) => {
          console.error(`reconcileOrphanAddons failed`, e);
          return of(undefined);
        }),
      )
      .subscribe();

    // When legacy installation setup is complete, migrate the addons
    this._warcraftInstallationService.legacyInstallationSrc$
      .pipe(
        first(),
        switchMap((installations) => from(this.handleLegacyInstallations(installations))),
      )
      .subscribe(() => console.log(`Legacy installation addons finished`));

    from(this.areAnyAddonsAvailableForUpdate())
      .pipe(first())
      .subscribe((updatesAvailable) => {
        this._anyUpdatesAvailableSrc.next(updatesAvailable);
      });
  }

  public isInstalling(addonId?: string): boolean {
    if (!addonId) {
      return this._activeInstalls.length > 0 || this._activeDependencyInstalls.size > 0;
    }
    return this._activeInstalls.find((install) => install.addon.id === addonId) !== undefined;
  }

  /** Progress of every addon whose dependencies are still being installed */
  public getDependencyInstallStatuses(): DependencyInstallEvent[] {
    return [...this._activeDependencyInstalls.values()];
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
    addon?: Addon,
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
    searchResult: AddonSearchResult,
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
        addon.externalLatestReleaseId ?? "",
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

  /**
   * Links an installed addon the scan could not identify (or identified wrongly) to a provider's addon, without
   * reinstalling it. The files on disk stay as they are: the installed version is still the one from the TOC, so
   * the addon shows as up to date only when the provider's latest release is that version. A rescan keeps the link.
   */
  public async linkAddon(addon: Addon, searchResult: AddonSearchResult, installation: WowInstallation): Promise<Addon> {
    const channelType = addon.channelType ?? installation.defaultAddonChannelType;
    const linked = this.createInstalledAddon(searchResult, installation, channelType, addon);
    if (!linked) {
      throw new Error(`No release of ${searchResult.name} found for ${installation.displayName}`);
    }

    const result: Addon = { ...linked, id: addon.id, isManuallyLinked: true };
    await this._addonStorage.setAsync(result.id, result);
    return result;
  }

  /**
   * An addon for files that are installed already but did not come from the provider's release: the installed
   * version stays the installed one, the release is only known when its version is that one. Undefined when the
   * provider has no release for the client.
   */
  private createInstalledAddon(
    searchResult: AddonSearchResult,
    installation: WowInstallation,
    channelType: AddonChannelType,
    installed: InstalledFiles,
  ): Addon | undefined {
    const latestFile = SearchResults.getLatestFile(searchResult, channelType);
    const addon = this.createAddon(searchResult, latestFile, installation);
    if (!addon || !latestFile) {
      return undefined;
    }

    const isLatestInstalled =
      !!installed.installedVersion &&
      installed.installedVersion.replace(/^v/i, "") === (latestFile.version ?? "").replace(/^v/i, "");

    return {
      ...addon,
      installedVersion: installed.installedVersion,
      installedExternalReleaseId: isLatestInstalled ? latestFile.externalId : undefined,
      installedAt: installed.installedAt,
      installedFolders: installed.installedFolders,
      installedFolderList: installed.installedFolderList,
      isLoadOnDemand: installed.isLoadOnDemand,
      autoUpdateEnabled: false,
      autoUpdateNotificationsEnabled: false,
    };
  }

  /** Drops a link made with linkAddon, the next scan identifies the addon again */
  public async unlinkAddon(addon: Addon, installation: WowInstallation): Promise<void> {
    await this._addonStorage.setAsync(addon.id, { ...addon, isManuallyLinked: false });
    await this.rescanInstallation(installation);
  }

  public async installBaseAddon(
    externalId: string,
    providerName: string,
    installation: WowInstallation,
    onUpdate: (installState: AddonInstallState, progress: number) => void = () => {},
    targetFile?: AddonSearchResultFile,
  ): Promise<Addon | undefined> {
    const existingAddon = await this.getByExternalId(externalId, providerName, installation.id);
    if (existingAddon) {
      throw new Error("Addon already installed");
    }

    const addon = await this.getAddon(externalId, providerName, installation, targetFile).toPromise();

    if (addon?.id !== undefined) {
      await this._addonStorage.setAsync(addon.id, addon);
      await this.installAddon(addon, onUpdate);
      return addon;
    }

    return undefined;
  }

  public async installPotentialAddon(
    potentialAddon: AddonSearchResult,
    installation: WowInstallation,
    onUpdate: (installState: AddonInstallState, progress: number) => void = () => {},
    targetFile?: AddonSearchResultFile,
  ): Promise<void> {
    const existingAddon = await this.getByExternalId(
      potentialAddon.externalId,
      potentialAddon.providerName,
      installation.id,
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
      await this.installAddon(addon, onUpdate);
    }
  }

  public getRequiredDependencies(addon: Addon): AddonDependency[] {
    return Array.isArray(addon.dependencies)
      ? addon.dependencies.filter((dep) => dep.type === AddonDependencyType.Required)
      : [];
  }

  public getAllAddonsAvailableForUpdate(wowInstallation?: WowInstallation): Promise<Addon[]> {
    return this._addonStorage.getAvailableForUpdate(wowInstallation?.id);
  }

  /**
   * Install every required dependency of the addon that is not already present in its installation.
   * Dependencies are looked up with the addon's own provider, installing a dependency installs its
   * dependencies in turn. A dependency that fails is logged and skipped, it never fails the addon.
   * All of them are resolved first and then queued together, so every one shows as pending at once.
   * Progress is reported on dependencyInstall$ with the addon as the parent.
   */
  public async installDependencies(addon: Addon): Promise<void> {
    const requiredDependencies = this.getRequiredDependencies(addon);
    if (!requiredDependencies.length) {
      return;
    }

    let progress: DependencyInstallEvent = {
      addon,
      state: DependencyInstallState.Resolving,
      total: requiredDependencies.length,
      completed: 0,
    };
    this.updateDependencyInstall(progress);

    try {
      const resolved = await this.resolveDependencies(addon, requiredDependencies);
      if (!resolved.length) {
        return;
      }

      progress = { ...progress, state: DependencyInstallState.Installing, total: resolved.length };
      this.updateDependencyInstall(progress);

      await Promise.all(
        resolved.map(async ({ pendingKey, dependencyAddon }) => {
          try {
            console.log(`[InstallDependency] ${addon.name} requires ${dependencyAddon.name}`);
            await this._addonStorage.setAsync(dependencyAddon.id, dependencyAddon);
            await this.installAddon(dependencyAddon);
          } catch (e) {
            console.error(`[InstallDependencies] ${addon.name}: failed to install ${dependencyAddon.externalId}`, e);
          } finally {
            this._pendingDependencyInstalls.delete(pendingKey);
            progress = { ...progress, completed: progress.completed + 1 };
            this.updateDependencyInstall(progress);
          }
        }),
      );
    } finally {
      this.updateDependencyInstall({ ...progress, state: DependencyInstallState.Complete });
    }
  }

  /**
   * The dependencies of the addon that need installing, looked up with its provider all at once.
   * Each one returned holds its pending key until its install is done.
   */
  private async resolveDependencies(
    addon: Addon,
    requiredDependencies: AddonDependency[],
  ): Promise<Array<{ pendingKey: string; dependencyAddon: Addon }>> {
    const providerName = addon.providerName ?? "";
    const installation = this._warcraftInstallationService.getWowInstallation(addon.installationId);
    const provider = this._addonProviderService.getProvider(providerName);
    if (!installation || !provider) {
      console.warn(`[InstallDependencies] ${addon.name}: installation or provider not found`);
      return [];
    }

    const installedAddons = await this._addonStorage.getAllForInstallationIdAsync(installation.id);

    const lookups = await Promise.all(
      requiredDependencies.map(async (dependency) => {
        // Another install already pulling in the same dependency will finish it, so there is no need to wait
        const pendingKey = `${installation.id}|${providerName}|${dependency.externalAddonId}`;
        if (this._pendingDependencyInstalls.has(pendingKey)) {
          return undefined;
        }

        this._pendingDependencyInstalls.add(pendingKey);
        try {
          const found = await this.findDependency(
            dependency,
            providerName,
            provider,
            installation,
            addon,
            installedAddons,
          );
          return { pendingKey, found };
        } catch (e) {
          console.error(`[InstallDependencies] ${addon.name}: failed to resolve ${dependency.externalAddonId}`, e);
          return { pendingKey, found: undefined };
        }
      }),
    );

    // The same folders may already be installed under another provider, or by hand, or claimed by
    // a dependency earlier in the list, so two of them never install the same folder
    const claimedFolders = installedAddons.flatMap((ia) => ia.installedFolderList ?? []);
    const resolved: Array<{ pendingKey: string; dependencyAddon: Addon }> = [];

    for (const lookup of lookups) {
      if (!lookup) {
        continue;
      }

      const { pendingKey, found } = lookup;
      if (found && _.intersection(found.folders, claimedFolders).length === 0) {
        resolved.push({ pendingKey, dependencyAddon: found.dependencyAddon });
        claimedFolders.push(...found.folders);
        continue;
      }
      this._pendingDependencyInstalls.delete(pendingKey);
    }

    return resolved;
  }

  /**
   * The addon to install for a dependency along with the folders it will install, or undefined when
   * it is already present or cannot be found.
   */
  private async findDependency(
    dependency: AddonDependency,
    providerName: string,
    provider: AddonProvider,
    installation: WowInstallation,
    parent: Addon,
    installedAddons: Addon[],
  ): Promise<{ dependencyAddon: Addon; folders: string[] } | undefined> {
    if (this.isDependencyInstalled(dependency.externalAddonId, providerName, installedAddons)) {
      return undefined;
    }

    const searchResult = await provider.getById(dependency.externalAddonId, installation);
    const latestFile = SearchResults.getLatestFile(searchResult, installation.defaultAddonChannelType);
    if (!searchResult || !latestFile) {
      console.warn(`[InstallDependencies] ${parent.name}: dependency not found ${dependency.externalAddonId}`);
      return undefined;
    }

    const dependencyAddon = this.createAddon(searchResult, latestFile, installation);
    return dependencyAddon?.id ? { dependencyAddon, folders: latestFile.folders } : undefined;
  }

  private isDependencyInstalled(externalAddonId: string, providerName: string, installedAddons: Addon[]): boolean {
    return this.findInstalledDependency(externalAddonId, providerName, installedAddons) !== undefined;
  }

  private findInstalledDependency(
    externalAddonId: string,
    providerName: string,
    installedAddons: Addon[],
  ): Addon | undefined {
    return installedAddons.find(
      (ia) =>
        (ia.providerName === providerName && ia.externalId === externalAddonId) ||
        !!ia.externalIds?.some((ext) => ext.providerName === providerName && ext.id === externalAddonId),
    );
  }

  /**
   * Resolve the name of each dependency and whether it is already installed, in the order given.
   * Installed addons are used first, the rest are fetched from the provider in a single call.
   * A dependency the provider cannot resolve falls back to its id for a name.
   */
  public async getDependencyDetails(
    dependencies: AddonDependency[],
    providerName: string,
    installation: WowInstallation,
  ): Promise<AddonDependencyDetail[]> {
    if (!dependencies.length) {
      return [];
    }

    const installedAddons = await this._addonStorage.getAllForInstallationIdAsync(installation.id);
    const details = dependencies.map((dependency): AddonDependencyDetail => {
      const installedAddon = this.findInstalledDependency(dependency.externalAddonId, providerName, installedAddons);
      return {
        externalAddonId: dependency.externalAddonId,
        name: installedAddon?.name ?? dependency.externalAddonId,
        installed: installedAddon !== undefined,
      };
    });

    const unresolved = details.filter((detail) => !detail.installed);
    const provider = this._addonProviderService.getProvider(providerName);
    if (!unresolved.length || !provider) {
      return details;
    }

    try {
      const result = await provider.getAll(
        installation,
        unresolved.map((detail) => detail.externalAddonId),
      );
      const installedFolders = installedAddons.flatMap((ia) => ia.installedFolderList ?? []);

      for (const detail of unresolved) {
        const searchResult = result.searchResults.find((sr) => sr.externalId === detail.externalAddonId);
        if (!searchResult) {
          continue;
        }

        detail.name = searchResult.name;
        // Same check installDependencies uses, so the dialog agrees with what an install would do
        const latestFile = SearchResults.getLatestFile(searchResult, installation.defaultAddonChannelType);
        detail.installed = _.intersection(latestFile?.folders ?? [], installedFolders).length > 0;
      }
    } catch (e) {
      console.error(`[DependencyDetails] failed to resolve dependencies`, e);
    }

    return details;
  }

  public async processAutoUpdates(): Promise<AutoUpdateResult> {
    const autoUpdateAddons = await this.getAutoUpdateEnabledAddons();
    const addonsWithUpdates = autoUpdateAddons.filter((addon) => AddonUtils.needsUpdate(addon));

    // An installation can be patched since the last check, so look at what it runs now
    const mismatches = await this.findGameVersionMismatches(addonsWithUpdates, true);
    const skipped = mismatches.map((mismatch) => mismatch.addon);

    const tasks = addonsWithUpdates
      .filter((addon) => !skipped.includes(addon))
      .map((addon) => {
        if (typeof addon.id !== "string") {
          return Promise.resolve(undefined);
        }
        return this.updateAddon(addon)
          .then(() => addon)
          .catch((e) => console.error(e));
      });

    const results = await Promise.all(tasks);
    return { updated: results.filter((res) => res !== undefined).map((res) => res as Addon), skipped };
  }

  /**
   * The addons whose update targets a newer game version than their installation runs. Fails open, an
   * addon is only listed when both versions are known, see AddonUtils.isAddonCompatibleWithInstallation.
   * @param refresh re-read the game versions from Battle.net first, for when the answer gates an install
   */
  public async findGameVersionMismatches(addons: Addon[], refresh = false): Promise<AddonVersionMismatch[]> {
    if (refresh) {
      try {
        await this._warcraftInstallationService.refreshGameVersions();
      } catch (e) {
        console.error("Failed to refresh game versions", e);
      }
    }

    const installations = await this._warcraftInstallationService.getWowInstallationsAsync();

    const mismatches: AddonVersionMismatch[] = [];
    for (const addon of addons) {
      const installation = installations.find((inst) => inst.id === addon.installationId);
      if (installation && !AddonUtils.isAddonCompatibleWithInstallation(addon.gameVersion, installation)) {
        mismatches.push({ addon, installation });
      }
    }

    return mismatches;
  }

  public getAutoUpdateEnabledAddons(): Promise<Addon[]> {
    return this._addonStorage.getAutoUpdateEnabled();
  }

  public getAllByExternalAddonId(externalAddonIds: string[]): Promise<Addon[]> {
    return this._addonStorage.getByExternalIds(externalAddonIds);
  }

  public async hasAnyWithExternalAddonIds(externalAddonIds: string[]): Promise<boolean> {
    const addons = await this.getAllByExternalAddonId(externalAddonIds);
    return addons.length > 0;
  }

  public async updateAddon(
    addon: Addon,
    onUpdate: (installState: AddonInstallState, progress: number) => void = () => {},
    originalAddon: Addon | undefined = undefined,
  ): Promise<void> {
    if (typeof addon !== "object") {
      return undefined;
    }

    await this.installOrUpdateAddon(addon, "update", onUpdate, originalAddon);

    // A newer release can require addons the installed one did not
    await this.installDependencies(addon);
  }

  public async installAddon(
    addon: Addon,
    onUpdate: (installState: AddonInstallState, progress: number) => void = () => {},
    originalAddon: Addon | undefined = undefined,
  ): Promise<void> {
    if (typeof addon !== "object") {
      console.warn("installAddon invalid addon id");
      return undefined;
    }

    // Track the dependencies from the start, so nothing reads as done between the addon's own
    // install completing and its dependencies being looked up
    const requiredDependencies = this.getRequiredDependencies(addon);
    if (requiredDependencies.length) {
      this.updateDependencyInstall(
        { addon, state: DependencyInstallState.Resolving, total: requiredDependencies.length, completed: 0 },
        false,
      );
    }

    try {
      await this.installOrUpdateAddon(addon, "install", onUpdate, originalAddon);
      await this._addonStorage.setAsync(addon.id, addon);
    } catch (e) {
      if (requiredDependencies.length) {
        this.updateDependencyInstall({ addon, state: DependencyInstallState.Complete, total: 0, completed: 0 });
      }
      throw e;
    }

    // Runs after the queue item has settled, so dependency installs never wait on the slot this one holds
    await this.installDependencies(addon);
  }

  public async installOrUpdateAddon(
    addon: Addon,
    installType: InstallType,
    onUpdate: (installState: AddonInstallState, progress: number) => void = () => {},
    originalAddon: Addon | undefined = undefined,
  ): Promise<void> {
    if (typeof addon !== "object" || !addon.downloadUrl) {
      console.error("installOrUpdateAddon invalid addon", addon);
      throw new Error(`Addon not found or invalid: ${addon?.id ?? "unknown"}`);
    }

    const wowInstallation = this.getWowInstallation(addon);
    const addonProvider = this.getAddonProvider(addon);

    const _onUpdate = async (installState: AddonInstallState, progress: number) => {
      if (installState === AddonInstallState.Retry) {
        await this.syncProviderAddons(wowInstallation, [addon], addonProvider);
        await delayMs(1000);
        return;
      }

      onUpdate?.call(this, installState, progress);
    };

    // addonInstalled$ gets its pending event from the queue itself
    onUpdate?.call(this, AddonInstallState.Pending, 0);

    // create a ref for resolving or rejecting once the queue grabs this.
    let completion = { resolve: () => {}, reject: () => {} };
    const promise = new Promise<void>((resolve, reject) => {
      completion = { resolve, reject };
    });

    const installQueueItem: InstallQueueItem = {
      addon,
      onUpdate: _onUpdate,
      completion,
      installType,
      originalAddon: originalAddon ? { ...originalAddon } : undefined,
    };
    this._addonInstallService.enqueue(installQueueItem);

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
    this._installingSrc.next(this.isInstalling());
  };

  /** Track the dependency progress of a parent addon, a Complete state drops it before anyone hears about it */
  private updateDependencyInstall(evt: DependencyInstallEvent, notify = true): void {
    if (evt.state === DependencyInstallState.Complete) {
      this._activeDependencyInstalls.delete(evt.addon.id);
    } else {
      this._activeDependencyInstalls.set(evt.addon.id, evt);
    }
    this._installingSrc.next(this.isInstalling());

    if (notify) {
      this._dependencyInstallSrc.next(evt);
    }
  }

  public async logDebugData(): Promise<void> {
    const curseProvider = this._addonProviderService.getProvider<CurseAddonProvider>(ADDON_PROVIDER_CURSEFORGE);
    const hubProvider = this._addonProviderService.getProvider<WowUpAddonProvider>(ADDON_PROVIDER_HUB);
    if (curseProvider === undefined) {
      throw new Error("curse provider not found");
    }
    if (hubProvider === undefined) {
      throw new Error("hub provider not found");
    }

    const clientMap = {};
    const installations = await this._warcraftInstallationService.getWowInstallationsAsync();
    for (const installation of installations) {
      const clientTypeName = getEnumName(WowClientType, installation.clientType);

      const { addonFolders } = await this._addonSyncApiService.prepareScan({ installationId: installation.id });

      const curseMap = {};
      const hubMap = {};

      addonFolders.forEach((af) => {
        if (af.cfScanResults !== undefined) {
          curseMap[af.cfScanResults.folderName] = af.cfScanResults.fingerprint;
        }

        if (af.wowUpScanResults !== undefined) {
          hubMap[af.wowUpScanResults.folderName] = af.wowUpScanResults.fingerprint;
        }
      });

      clientMap[clientTypeName] = {
        curse: curseMap,
        hub: hubMap,
      };

      console.log(`clientType ${clientTypeName} addon fingerprints`);
    }

    console.log(JSON.stringify(clientMap));
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

  public async getAddonByUrl(url: URL, installation: WowInstallation): Promise<SearchByUrlResult | undefined> {
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
    targetFile?: AddonSearchResultFile,
  ): Observable<Addon | undefined> {
    const targetAddonChannel = installation.defaultAddonChannelType;
    const provider = this._addonProviderService.getProvider(providerName);
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    return from(provider.getById(externalId, installation)).pipe(
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
      }),
    );
  }

  public getInstallBasePath(addon: Addon): string {
    const installation = this.getWowInstallation(addon);
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
    removeDirectories = true,
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
          `[RemoveAddonDirectory] ${addon.providerName ?? ""} ${addon.externalId ?? "NO_EXT_ID"} ${addonDirectory}`,
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
        addon.installationId,
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

  /**
   * Scan the installation's addon folders and replace its saved addons with the result.
   * Only one scan runs per installation at a time: a call made while one is running waits for it
   * and then scans again, so overlapping scans can't each save a copy of every addon (#1561).
   */
  public rescanInstallation(installation: WowInstallation): Promise<Addon[]> {
    if (!installation) {
      return Promise.resolve([]);
    }

    const queued = this._queuedRescans.get(installation.id);
    if (queued !== undefined) {
      return queued;
    }

    const active = this._activeRescans.get(installation.id);
    if (active === undefined) {
      return this.startRescan(installation);
    }

    const next = active
      .catch(() => undefined)
      .then(() => {
        this._queuedRescans.delete(installation.id);
        return this.startRescan(installation);
      });
    this._queuedRescans.set(installation.id, next);
    return next;
  }

  /**
   * Tries again to identify the installation's unidentified addons, like a rescan but without the scan progress and
   * only for the folders whose TOC references a provider (a provider ID or X-Repository). Folders without one would
   * only be identified by their files, which a rescan already tried. Addons it identifies replace the unknown ones;
   * everything else stays as it is. Returns how many addons were identified. Only runs when the user asks for it from
   * the page menu, never on its own.
   */
  public async rematchUnknownAddons(installation: WowInstallation): Promise<number> {
    if (!installation || this._activeRescans.has(installation.id) || this._queuedRescans.has(installation.id)) {
      return 0;
    }

    const rematch = this.rematchAndReplaceUnknown(installation);
    // Registered like a rescan, so a rescan asked for meanwhile waits for it instead of racing it
    const active = rematch.catch(() => 0).then(() => this._addonStorage.getAllForInstallationIdAsync(installation.id));
    this._activeRescans.set(
      installation.id,
      active.finally(() => this._activeRescans.delete(installation.id)),
    );

    return await rematch;
  }

  private async rematchAndReplaceUnknown(installation: WowInstallation): Promise<number> {
    const addons = await this._addonStorage.getAllForInstallationIdAsync(installation.id);
    const unknownAddons = addons.filter(
      (addon) => addon.providerName === ADDON_PROVIDER_UNKNOWN && addon.isManuallyLinked !== true,
    );
    const folders = new Set(unknownAddons.flatMap((addon) => addon.installedFolderList ?? []));
    if (folders.size === 0) {
      return 0;
    }

    const scanned = await this.scanAddons(installation, {
      folderNames: [...folders],
      folderFilter: (addonFolder) => this.hasProviderReference(addonFolder, installation),
      quiet: true,
    });
    const identified = scanned.filter((addon) => addon.providerName !== ADDON_PROVIDER_UNKNOWN);
    if (identified.length === 0) {
      return 0;
    }

    const identifiedFolders = new Set(identified.flatMap((addon) => addon.installedFolderList ?? []));
    const remaining = addons.filter(
      (addon) =>
        !unknownAddons.includes(addon) ||
        !(addon.installedFolderList ?? []).some((folder) => identifiedFolders.has(folder)),
    );
    // An identified addon can already be installed, e.g. when its main folder was known and only a sub folder wasn't
    const added = identified.filter(
      (addon) =>
        !remaining.some(
          (existing) => existing.providerName === addon.providerName && existing.externalId === addon.externalId,
        ),
    );

    console.log(
      `[addon-service] identified ${identified.length} unknown addon(s) in ${installation.displayName}: ${identified
        .map((addon) => addon.name)
        .join(", ")}`,
    );

    await this._addonStorage.replaceAllForInstallation(installation.id, [...remaining, ...added]);
    this._addonActionSrc.next({ type: "scan" });
    return identified.length;
  }

  private startRescan(installation: WowInstallation): Promise<Addon[]> {
    const rescan = this.scanAndReplaceAddons(installation).finally(() => this._activeRescans.delete(installation.id));
    this._activeRescans.set(installation.id, rescan);
    return rescan;
  }

  private async scanAndReplaceAddons(installation: WowInstallation): Promise<Addon[]> {
    console.debug(`[addon-service] rescanInstallation: ${installation.displayName}`);
    // Main keeps the saved addons' settings and replaces them with what the scan found
    const addons = await this.scanAddons(installation, { save: true });

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

    if (rescan) {
      return await this.rescanInstallation(installation);
    }

    const addons = await this._addonStorage.getAllForInstallationIdAsync(installation.id);
    if (addons.length > 0) {
      return addons;
    }

    // Nothing saved yet: share a scan that's already running rather than starting another
    return await (this._activeRescans.get(installation.id) ?? this.rescanInstallation(installation));
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
    console.debug("syncClient", installation.displayName);
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
          await this.applySyncResults(installation, provider, installationAddons, [], errors);
        }

        // Process the update results for each installation
        for (const key of Object.keys(searchResults.installationResults)) {
          const addonSearchResults = searchResults.installationResults[key];
          if (addonSearchResults.length === 0) {
            continue;
          }

          const installation = installations.find((i) => i.id === key);
          const installationAddons = batchedAddons.filter((addon) => addon.installationId === key);
          await this.applySyncResults(installation, provider, installationAddons, addonSearchResults, []);
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
              installationName: installation.displayName,
              innerError: e,
            }),
          );
          didSync = false;
        }
      }
    }

    const updatesAvailable = await this.areAnyAddonsAvailableForUpdate();
    this._anyUpdatesAvailableSrc.next(updatesAvailable);

    return didSync;
  }

  private async syncProviderAddons(installation: WowInstallation, addons: Addon[], addonProvider: AddonProvider) {
    const providerAddonIds = this.getExternalIdsForProvider(addonProvider, addons);
    if (!providerAddonIds.length) {
      return;
    }

    const getAllResult = await addonProvider.getAll(installation, providerAddonIds);
    await this.applySyncResults(installation, addonProvider, addons, getAllResult.searchResults, getAllResult.errors);
  }

  /**
   * Hand one provider's answer to main, which applies it to the addons and saves them. The results are
   * copied back onto `addons` because callers hold on to them, e.g. an install retry needs the new
   * download url.
   */
  private async applySyncResults(
    installation: WowInstallation | undefined,
    addonProvider: AddonProvider,
    addons: Addon[],
    searchResults: AddonSearchResult[],
    errors: Error[],
  ): Promise<void> {
    const failures: AddonSyncFailure[] = errors.map((error) => ({
      addonId: (error as any).addonId,
      warningType: error instanceof GenericProviderError ? error.warningType : undefined,
    }));

    const applied = await this._addonSyncApiService.applySync({
      providerName: addonProvider.name,
      addons,
      searchResults,
      failures,
    });

    const updatedById = new Map(applied.addons.map((updated) => [updated.id, updated]));
    for (const addon of addons) {
      const updated = updatedById.get(addon.id);
      if (updated) {
        Object.assign(addon, updated);
      }
    }

    const installationName = installation?.displayName ?? "";
    errors.forEach((error, idx) => {
      this._syncErrorSrc.next(
        new AddonSyncError({
          providerName: addonProvider.name,
          installationName,
          innerError: error,
          addonName: applied.failureAddonNames[idx],
        }),
      );
    });

    for (const noFileAddon of applied.noFileAddons) {
      this._syncErrorSrc.next(
        new AddonSyncError({
          providerName: noFileAddon.providerName,
          installationName,
          addonName: noFileAddon.name,
        }),
      );
    }
  }

  private getExternalIdsForProvider(addonProvider: AddonProvider, addons: Addon[]): string[] {
    return _.filter(addons, (addon) => addon.providerName === addonProvider.name)
      .map((f) => f.externalId)
      .filter((id): id is string => typeof id === "string");
  }

  private async migrateLocalAddons(installation: WowInstallation): Promise<void> {
    const existingAddons = await this.getAllAddons(installation);
    if (!existingAddons.length) {
      console.log(`[MigrateInstall] ${installation.displayName} no addons found`);
      return;
    }

    const needsMigration = existingAddons.some((addon) => this.needsMigration(addon));
    if (!needsMigration) {
      console.log(`[MigrateInstall] ${installation.displayName} No addons needed to be migrated`);
      return;
    }

    let migratedCt = 0;
    for (const addon of existingAddons) {
      const didMigrate = await this.migrateLocalAddon(addon);
      if (didMigrate) {
        migratedCt += 1;
      }
    }

    console.log(`[MigrateInstall] Local addons complete: [${migratedCt}] ${installation.displayName}`);
  }

  public async migrateDeep(installation: WowInstallation): Promise<void> {
    await this.migrateLocalAddons(installation);

    console.log(`[MigrateInstall] ${installation.displayName}`);
    const existingAddons = await this.getAllAddons(installation);
    if (!existingAddons.length) {
      console.log(`[MigrateInstall] ${installation.displayName} no addons found`);
      return;
    }

    const needsMigration = existingAddons.some((addon) => this.needsMigration(addon));
    if (!needsMigration) {
      console.log(`[MigrateInstall] ${installation.displayName} No addons needed to be migrated`);
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
      typeof addon.gameVersion === "string" ||
      addon.providerName === ADDON_PROVIDER_HUB_LEGACY ||
      typeof addon.autoUpdateNotificationsEnabled === "undefined" ||
      !addon.installedFolderList ||
      !addon.externalChannel ||
      (provider?.shouldMigrate(addon) ?? false);

    return migrationNeeded;
  }

  private async migrateLocalAddon(addon: Addon): Promise<boolean> {
    let changed = false;
    if (typeof addon.gameVersion === "string") {
      console.log(`[MigrateAddon] '${addon.name}' Updating gameVersion array`);
      addon.gameVersion = [addon.gameVersion];
      changed = true;
    }

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
      (sa) => sa.externalId === addon.externalId && addon.providerName === sa.providerName,
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

  /**
   * Read the installation's addons off disk. Main lists, fingerprints and assembles them; only the
   * providers' matching runs here, between the two calls, until the providers move to main too.
   * @param options.save replace the installation's saved addons with the result, keeping the saved addons of
   * providers a scan can't find again (e.g. GitHub) and the ones the user linked. Without it the scan only reads.
   * @param options.folderNames limits the scan to these addon folders, options.folderFilter to the ones it accepts
   * @param options.quiet keeps the scan out of the scan progress shown to the user (like the folder limits, for the
   * retry of unidentified addons)
   */
  private async scanAddons(installation: WowInstallation, options: ScanOptions = {}): Promise<Addon[]> {
    if (!installation) {
      return [];
    }

    const { save = false, folderNames, folderFilter, quiet = false } = options;

    const emitScanUpdate = (update: ScanUpdate) => {
      if (!quiet) {
        this._scanUpdateSrc.next(update);
      }
    };

    emitScanUpdate({
      type: ScanUpdateType.Start,
    });

    try {
      const nonRescanProviders = save ? this._addonProviderService.getNonRescanProviderNames() : undefined;
      const prepared = await this._addonSyncApiService.prepareScan({
        installationId: installation.id,
        nonRescanProviders,
        ...(folderNames ? { folderNames } : {}),
      });
      const addonFolders = folderFilter ? prepared.addonFolders.filter(folderFilter) : prepared.addonFolders;

      if (addonFolders.length > 0) {
        emitScanUpdate({
          type: ScanUpdateType.Update,
          currentCount: 0,
          totalCount: addonFolders.length,
        });

        await this.matchAddonFolders(installation, addonFolders);

        await this.matchByRepository(
          installation,
          installation.defaultAddonChannelType,
          addonFolders.filter((af) => !af.ignoreReason && !af.matchingAddon && af.tocs.length > 0),
        );
      }

      const addons = await this._addonSyncApiService.completeScan({
        installationId: installation.id,
        addonFolders,
        nonRescanProviders,
        providerNames: this._addonProviderService.getProviderNames(),
        save,
      });

      // Not the array itself: devtools keeps a live reference to whatever is logged so it can be
      // expanded, which pinned every addon of every scan in the inspector's heap for the life of
      // the session.
      console.debug(`scan complete: ${addons.length} addons`);

      return addons;
    } finally {
      emitScanUpdate({
        type: ScanUpdateType.Complete,
      });
    }
  }

  /** Whether the folder's TOC names the addon's page or ID at a provider, see matchByRepository and the provider scans */
  private hasProviderReference(addonFolder: AddonFolder, installation: WowInstallation): boolean {
    const toc = this._tocService.getTocForGameType2(addonFolder.name, addonFolder.tocs, installation.clientType);
    return [toc?.curseProjectId, toc?.wagoAddonId, toc?.wowInterfaceId, toc?.tukUiProjectId, toc?.repository].some(
      (value) => !!value?.trim(),
    );
  }

  /**
   * Matches the folders whose TOC names their repository (X-Repository) through the provider that knows the URL,
   * e.g. a GitHub repository. Only a provider release for the client is accepted.
   */
  private async matchByRepository(
    installation: WowInstallation,
    channelType: AddonChannelType,
    addonFolders: AddonFolder[],
  ): Promise<void> {
    for (const addonFolder of addonFolders) {
      const toc = this._tocService.getTocForGameType2(addonFolder.name, addonFolder.tocs, installation.clientType);
      let url: URL;
      try {
        url = new URL(toc?.repository?.trim() ?? "");
      } catch {
        continue;
      }

      const provider = this._addonProviderService
        .getEnabledAddonProviders()
        .find((addonProvider) => addonProvider.isValidAddonUri(url));
      if (!provider || !toc) {
        continue;
      }

      try {
        const result = await provider.searchByUrl(url, installation);
        if (!result?.searchResult) {
          continue;
        }

        const installed: InstalledFiles = {
          installedVersion: toc.version ?? "",
          installedAt: addonFolder.fileStats?.birthtime ?? new Date(),
          installedFolders: addonFolder.name,
          installedFolderList: [addonFolder.name],
          isLoadOnDemand: toc.loadOnDemand === "1",
        };
        const addon = this.createInstalledAddon(result.searchResult, installation, channelType, installed);
        if (addon) {
          addonFolder.matchingAddon = addon;
        }
      } catch (e) {
        console.warn(`[addon-service] repository of ${addonFolder.name} not found at ${provider.name}`, e);
      }
    }
  }

  /** Let each enabled provider set matchingAddon on the folders no provider before it claimed */
  private async matchAddonFolders(installation: WowInstallation, addonFolders: AddonFolder[]): Promise<void> {
    const enabledProviders = this._addonProviderService.getEnabledAddonProviders();
    for (const provider of enabledProviders) {
      try {
        const validFolders = addonFolders.filter((af) => !af.ignoreReason && !af.matchingAddon && af.tocs.length > 0);

        await provider.scan(installation, installation.defaultAddonChannelType, validFolders);
      } catch (e) {
        console.error("scan failed: " + provider.name);
        console.error(e);
        this._scanErrorSrc.next(
          new AddonScanError({
            providerName: provider.name,
            innerError: e,
          }),
        );
      }
    }
  }

  public async setProvider(
    addon: Addon | undefined,
    externalId: string,
    providerName: string,
    installation: WowInstallation,
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

    await this.installAddon(externalAddon, undefined, addon);
    await this.removeAddon(addon, false, false);
  }

  public async reconcileOrphanAddons(installations: WowInstallation[]): Promise<void> {
    const addons = await this._addonStorage.getAll();

    for (const addon of addons) {
      if (!addon.installationId) {
        console.debug(
          `Removing detached legacy addon [${getEnumName(WowClientType, addon.clientType)}]: ${addon.name}`,
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
      }),
    ).pipe(
      map((results) => {
        return _.orderBy(results.flat(1), ["downloadCount"]).reverse();
      }),
    );
  }

  public async getByExternalId(
    externalId: string,
    providerName: string,
    installationId: string,
  ): Promise<Addon | undefined> {
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
    if (addon.externalIds && containsOwnExternalId(addon)) {
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

      setExternalIds(addon, primaryToc, new Set(this._addonProviderService.getProviderNames()));
      await this.saveAddon(addon);
    } catch (e) {
      console.error(e);
    }
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
      installation.clientType,
    );

    const tocPaths = addonTocs.map((toc) => toc.filePath);
    return tocPaths;
  }

  private createAddon(
    searchResult: AddonSearchResult,
    latestFile: AddonSearchResultFile | undefined,
    installation: WowInstallation,
  ): Addon | undefined {
    if (!latestFile) {
      return undefined;
    }

    const dependencies = Array.isArray(latestFile.dependencies)
      ? latestFile.dependencies.map(this.createAddonDependency)
      : [];

    const fundingLinks = Array.isArray(searchResult.fundingLinks) ? [...searchResult.fundingLinks] : [];

    return {
      id: uuidv4(),
      name: searchResult.name,
      thumbnailUrl: searchResult.thumbnailUrl,
      latestVersion: latestFile.version,
      clientType: installation.clientType,
      externalId: searchResult.externalId.toString(),
      gameVersion: getGameVersionList([latestFile.gameVersion]),
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

  private getWowInstallation(addon: Addon): WowInstallation {
    const installation = this._warcraftInstallationService.getWowInstallation(addon.installationId);
    if (installation === undefined) {
      throw new Error(`installation not found: ${addon.installationId ?? ""}`);
    }
    return installation;
  }

  private getAddonProvider(addon: Addon): AddonProvider {
    const addonProvider = this._addonProviderService.getProvider(addon.providerName ?? "");
    if (addonProvider === undefined) {
      throw new Error(`Provider not found: ${addon.providerName ?? ""}`);
    }

    return addonProvider;
  }
}
