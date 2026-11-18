import { Addon, AddonFolder, WowInstallation } from "wowup-lib-core";

import {
  AddonScanEvent,
  AddonScanRequest,
  AddonScanSource,
  AppliedAddonSync,
  ApplyAddonSyncRequest,
  FolderScanResults,
  PrepareAddonScanRequest,
  PreparedAddonScan,
  ScanAddonsRequest,
} from "../../../src/common/models/addon-scan";
import { ProviderLookup } from "../addon-providers/addon-provider-registry";
import { serializeProviderError } from "../addon-providers/provider-errors";
import { AddonRepository } from "./addon-repository";
import { assembleScannedAddons, mergeAddonSettings, removeNonRescanFolders, ScanAssemblyLog } from "./scan-assembly";
import { applyAddonSync } from "./sync-results";

export interface AddonSyncDeps {
  repository: AddonRepository;
  getInstallations: () => WowInstallation[];
  getAddonFolderPath: (installation: WowInstallation) => string;
  listAddons: (addonFolderPath: string, scanSymlinks: boolean) => Promise<AddonFolder[]>;
  /** The user's "scan symlinked folders" preference */
  getScanSymlinks: () => boolean;
  /** Which fingerprints this build's providers match on */
  fingerprintSources: AddonScanSource[];
  /** Names of the directories directly inside a folder */
  listDirectories: (dirPath: string) => Promise<string[]>;
  getFingerprints: (request: AddonScanRequest) => Promise<FolderScanResults[]>;
  getLatestDirUpdateTime: (dirPath: string) => Promise<number>;
  newId: () => string;
  /** Undefined until the renderer has sent the providers' config */
  getProviders: () => ProviderLookup | undefined;
  /** Each scan's progress and provider failures, see `AddonScanEvent` */
  onScanEvent: (event: AddonScanEvent) => void;
  log: ScanAssemblyLog & { error(...args: unknown[]): void };
}

/**
 * Scanning and syncing an installation's addons. A scan lists and fingerprints the folders, lets each
 * enabled provider match the ones no provider before it claimed, and builds the addon list from that.
 * Syncing still asks the providers from the renderer, which hands main each answer (applySync).
 */
export class AddonSyncService {
  /** Saving scan running right now, by installation id */
  private readonly _activeScans = new Map<string, Promise<Addon[]>>();
  /** Saving scan waiting for the running one to finish, by installation id */
  private readonly _queuedScans = new Map<string, Promise<Addon[]>>();

  public constructor(private readonly deps: AddonSyncDeps) {}

  public scan(request: ScanAddonsRequest): Promise<Addon[]> {
    if (!request.save) {
      return this.runScan(request.installationId, false);
    }

    const { installationId } = request;
    const active = this._activeScans.get(installationId);
    if (active !== undefined && request.joinRunning) {
      return active;
    }

    const queued = this._queuedScans.get(installationId);
    if (queued !== undefined) {
      return queued;
    }

    if (active === undefined) {
      return this.startSavingScan(installationId);
    }

    const next = active
      .catch(() => undefined)
      .then(() => {
        this._queuedScans.delete(installationId);
        return this.startSavingScan(installationId);
      });
    this._queuedScans.set(installationId, next);
    return next;
  }

  private startSavingScan(installationId: string): Promise<Addon[]> {
    const scan = this.runScan(installationId, true).finally(() => this._activeScans.delete(installationId));
    this._activeScans.set(installationId, scan);
    return scan;
  }

  private async runScan(installationId: string, save: boolean): Promise<Addon[]> {
    const providers = this.deps.getProviders();
    if (!providers) {
      throw new Error("Addon providers are not initialized");
    }

    const installation = this.getInstallation(installationId);
    this.deps.onScanEvent({ installationId, type: "start" });
    try {
      const nonRescanProviders = save ? providers.getNonRescanProviderNames() : undefined;
      const { addonFolders } = await this.prepareScan({ installationId, nonRescanProviders });

      if (addonFolders.length > 0) {
        this.deps.onScanEvent({ installationId, type: "folders", totalCount: addonFolders.length });
        await this.matchAddonFolders(installation, addonFolders, providers);
      }

      return await this.completeScan(installation, addonFolders, providers, nonRescanProviders, save);
    } finally {
      this.deps.onScanEvent({ installationId, type: "complete" });
    }
  }

  /** Let each enabled provider set matchingAddon on the folders no provider before it claimed */
  private async matchAddonFolders(
    installation: WowInstallation,
    addonFolders: AddonFolder[],
    providers: ProviderLookup,
  ): Promise<void> {
    for (const provider of providers.getEnabledProviders()) {
      try {
        const validFolders = addonFolders.filter((af) => !af.ignoreReason && !af.matchingAddon && af.tocs.length > 0);
        await provider.scan(installation, installation.defaultAddonChannelType, validFolders);
      } catch (e) {
        this.deps.log.error(`scan failed: ${provider.name}`, e);
        this.deps.onScanEvent({
          installationId: installation.id,
          type: "providerError",
          providerName: provider.name,
          error: serializeProviderError(e),
        });
      }
    }
  }

  /** List the installation's addon folders, flag the ones to skip, and fingerprint them */
  public async prepareScan(request: PrepareAddonScanRequest): Promise<PreparedAddonScan> {
    const installation = this.getInstallation(request.installationId);
    const addonFolderPath = this.deps.getAddonFolderPath(installation);
    const addonFolders = await this.deps.listAddons(addonFolderPath, this.deps.getScanSymlinks());
    if (addonFolders.length === 0) {
      return { addonFolders: [] };
    }

    await this.markGitFolders(addonFolders);

    if (Array.isArray(request.nonRescanProviders)) {
      removeNonRescanFolders(
        addonFolders,
        this.deps.repository.getAllForInstallation(installation.id),
        new Set(request.nonRescanProviders),
        this.deps.log,
      );
    }

    await this.setFingerprints(addonFolders);

    return { addonFolders };
  }

  /** Build the installation's addon list from the matched folders, and save it when asked */
  private async completeScan(
    installation: WowInstallation,
    addonFolders: AddonFolder[],
    providers: ProviderLookup,
    nonRescanProviders: string[] | undefined,
    save: boolean,
  ): Promise<Addon[]> {
    const existing = this.deps.repository.getAllForInstallation(installation.id);

    // Read from the store now rather than before matching, so anything saved during the providers' matching counts
    const nonRescan = new Set(nonRescanProviders ?? []);
    const keptAddons = existing.filter((addon) => nonRescan.has(addon.providerName ?? ""));

    const scanned = await assembleScannedAddons(
      addonFolders,
      keptAddons,
      installation,
      new Set(providers.getProviderNames()),
      this.deps,
    );

    if (!save) {
      return scanned;
    }

    const addons = mergeAddonSettings(existing, scanned);
    this.deps.log.debug(`addons: ${addons.length} for ${installation.displayName}`);
    this.deps.repository.replaceAllForInstallation(installation.id, addons);

    return addons;
  }

  /**
   * Apply one provider's sync answer to the saved copy of each addon it was asked about and save the
   * ones that changed. Runs without awaiting between the read and the write, so nothing saved in main
   * can land in between and be overwritten.
   */
  public applySync(request: ApplyAddonSyncRequest): AppliedAddonSync {
    const savedIds = new Set<string>();
    const addons = request.addons.map((sent) => {
      const stored = this.deps.repository.getById(sent.id);
      if (stored) {
        savedIds.add(stored.id);
      }
      return stored ?? sent;
    });

    const { changed, ...applied } = applyAddonSync({ ...request, addons }, this.deps.log);
    this.deps.repository.saveAll(changed.filter((addon) => savedIds.has(addon.id)));
    return applied;
  }

  private getInstallation(installationId: string): WowInstallation {
    const installation = this.deps.getInstallations().find((i) => i.id === installationId);
    if (!installation) {
      throw new Error(`installation not found: ${installationId}`);
    }
    return installation;
  }

  private async markGitFolders(addonFolders: AddonFolder[]): Promise<void> {
    for (const addonFolder of addonFolders) {
      const directories = await this.deps.listDirectories(addonFolder.path);
      if (directories.some((dir) => dir.toLowerCase() === ".git")) {
        addonFolder.ignoreReason = "git_repo";
      }
    }
  }

  private async setFingerprints(addonFolders: AddonFolder[]): Promise<void> {
    const sources = this.deps.fingerprintSources;
    const results = await this.deps.getFingerprints({ filePaths: addonFolders.map((af) => af.path), sources });
    const resultsByPath = new Map(results.map((result) => [result.path, result]));

    for (const addonFolder of addonFolders) {
      const result = resultsByPath.get(addonFolder.path);
      addonFolder.wowUpScanResults = result?.wowup;
      if (sources.includes("curseforge")) {
        addonFolder.cfScanResults = result?.curseforge;
      }
    }
  }
}
