import { Addon, AddonFolder, WowInstallation } from "wowup-lib-core";

import {
  AddonScanRequest,
  AddonScanSource,
  AppliedAddonSync,
  ApplyAddonSyncRequest,
  CompleteAddonScanRequest,
  FolderScanResults,
  PrepareAddonScanRequest,
  PreparedAddonScan,
} from "../../../src/common/models/addon-scan";
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
  log: ScanAssemblyLog;
}

/**
 * Scanning and syncing an installation's addons, except for talking to the addon providers, which
 * still happens in the renderer (UI_DECOUPLING_PLAN.md Phase 5). A scan is therefore two calls with
 * the providers' matching in between: prepareScan, then completeScan.
 */
export class AddonSyncService {
  public constructor(private readonly deps: AddonSyncDeps) {}

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
  public async completeScan(request: CompleteAddonScanRequest): Promise<Addon[]> {
    const installation = this.getInstallation(request.installationId);
    const existing = this.deps.repository.getAllForInstallation(installation.id);

    // Read from the store now rather than at prepare, so anything saved during the providers' matching counts
    const nonRescan = new Set(request.nonRescanProviders ?? []);
    const keptAddons = existing.filter((addon) => nonRescan.has(addon.providerName ?? ""));

    const scanned = await assembleScannedAddons(
      request.addonFolders,
      keptAddons,
      installation,
      new Set(request.providerNames),
      this.deps,
    );

    if (!request.save) {
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
