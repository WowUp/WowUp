import { createHash } from "crypto";
import * as fsp from "fs/promises";
import * as path from "path";

import { WowClientType, WowInstallation } from "wowup-lib-core";

import {
  SETTINGS_SYNC_ERROR_BUSY,
  SETTINGS_SYNC_ERROR_GAME_RUNNING,
  SETTINGS_SYNC_ERROR_NOT_CONFIGURED,
  SettingsSyncAddon,
  SettingsSyncDeviceAddons,
  SettingsSyncResult,
  SettingsSyncStatus,
} from "../../../src/common/models/settings-sync";
import {
  createSyncCode,
  deriveSyncKeys,
  getCodeHint,
  normalizeSyncCode,
  open,
  opaqueName,
  seal,
  SyncKeys,
} from "./sync-crypto";
import {
  applyPlanToRemote,
  BaseFiles,
  baseFromRemote,
  isLiveEntry,
  isSyncedPath,
  LocalFiles,
  MAX_SYNC_FILE_BYTES,
  planSync,
  RemoteFiles,
} from "./sync-plan";
import { SyncTransport } from "./sync-transport";

/** What one game flavor's vault holds besides the file contents */
export interface SyncManifest {
  format: 1;
  /** Bumped on every write, so a sync that raced another device notices and runs again */
  version: number;
  updatedAt: number;
  updatedBy: string;
  files: RemoteFiles;
  devices: { [deviceId: string]: SettingsSyncDeviceAddons };
}

export interface SettingsSyncConfig {
  code?: string;
  folderPath?: string;
  autoSync: boolean;
  installationIds: string[];
}

export interface SettingsSyncDeps {
  getConfig(): SettingsSyncConfig;
  saveConfig(config: Partial<SettingsSyncConfig>): void;
  getInstallations(): WowInstallation[];
  getTransport(folderPath: string): SyncTransport;
  /** Addons the user manages in WowUp for an installation; ignored ones left out */
  getAddons(installationId: string): SettingsSyncAddon[];
  /** Zips the WTF folder into WowUp's WTF backup folder and returns the zip's path */
  createBackup(installation: WowInstallation, wtfPath: string): Promise<string>;
  isGameRunning(): Promise<boolean>;
  /** Folder for this device's own sync state (the base of each three-way merge, last results) */
  stateFolderPath: string;
  deviceId: string;
  deviceName: string;
  now(): number;
  log: { info(...args: unknown[]): void; warn(...args: unknown[]): void; error(...args: unknown[]): void };
}

const MAX_ATTEMPTS = 3;
const LOCAL_TEMP_SUFFIX = ".wowup-sync-tmp";

interface LocalState {
  vaultId: string;
  /** The vault's folder; missing in state written before it was recorded */
  location?: string;
  base: BaseFiles;
}

/**
 * Keeps the settings in each chosen installation's WTF folder the same across the user's devices.
 * Settings are encrypted on the device with a key derived from the sync code, then stored through
 * a transport that never sees them in the clear.
 */
export class SettingsSyncService {
  private running = false;
  private readonly lastResults: { [installationId: string]: SettingsSyncResult } = {};

  public constructor(private readonly deps: SettingsSyncDeps) {}

  public getStatus(): SettingsSyncStatus {
    const config = this.deps.getConfig();
    return {
      hasCode: !!config.code,
      codeHint: config.code ? getCodeHint(config.code) : undefined,
      folderPath: config.folderPath,
      autoSync: config.autoSync,
      installationIds: config.installationIds,
      lastResults: { ...this.lastResults },
    };
  }

  public createCode(): string {
    const code = createSyncCode();
    this.deps.saveConfig({ code });
    return code;
  }

  /** Saves a code typed in from another device; throws SETTINGS_SYNC_ERROR_INVALID_CODE on a typo */
  public setCode(input: string): string {
    const code = normalizeSyncCode(input);
    this.deps.saveConfig({ code });
    return code;
  }

  public getCode(): string | undefined {
    return this.deps.getConfig().code;
  }

  public clear(): void {
    this.deps.saveConfig({ code: undefined, installationIds: [], autoSync: false });
  }

  public setFolder(folderPath: string): void {
    this.deps.saveConfig({ folderPath });
  }

  public setInstallations(installationIds: string[]): void {
    this.deps.saveConfig({ installationIds });
  }

  public setAutoSync(autoSync: boolean): void {
    this.deps.saveConfig({ autoSync });
  }

  /**
   * With auto sync on: syncs shortly after start, and each time the game closes, which is when
   * WTF has just been written. Returns a function that stops watching.
   */
  public startAutoSync(
    onResults: (results: SettingsSyncResult[]) => void,
    pollMs = 30_000,
    startDelayMs = 15_000,
  ): () => void {
    let wasRunning: boolean | undefined;
    let stopped = false;

    const runIfEnabled = async () => {
      const config = this.deps.getConfig();
      if (stopped || !config.autoSync || !config.code || !config.folderPath || this.running) {
        return;
      }
      const results = await this.syncAll();
      if (results.length > 0 && !stopped) {
        onResults(results);
      }
    };

    const poll = async () => {
      try {
        const running = await this.deps.isGameRunning();
        if (wasRunning === true && !running) {
          this.deps.log.info("[settings-sync] game closed, syncing");
          await runIfEnabled();
        }
        wasRunning = running;
      } catch (e) {
        this.deps.log.warn("[settings-sync] auto sync check failed", e);
      }
    };

    const startTimer = setTimeout(() => {
      runIfEnabled().catch((e) => this.deps.log.warn("[settings-sync] start sync failed", e));
    }, startDelayMs);
    const pollTimer = setInterval(() => void poll(), pollMs);

    return () => {
      stopped = true;
      clearTimeout(startTimer);
      clearInterval(pollTimer);
    };
  }

  /** Syncs every installation the user turned sync on for; one failing doesn't stop the rest */
  public async syncAll(): Promise<SettingsSyncResult[]> {
    const results: SettingsSyncResult[] = [];
    for (const installationId of this.deps.getConfig().installationIds) {
      try {
        results.push(await this.sync(installationId));
      } catch (e) {
        this.deps.log.error(`[settings-sync] sync failed for ${installationId}`, e);
      }
    }
    return results;
  }

  public async sync(installationId: string): Promise<SettingsSyncResult> {
    if (this.running) {
      throw new Error(SETTINGS_SYNC_ERROR_BUSY);
    }
    this.running = true;
    try {
      for (let attempt = 1; ; attempt++) {
        try {
          const result = await this.syncOnce(installationId);
          this.lastResults[installationId] = result;
          return result;
        } catch (e) {
          if (e instanceof ManifestChangedError && attempt < MAX_ATTEMPTS) {
            this.deps.log.info(`[settings-sync] another device synced meanwhile, retrying (${attempt})`);
            continue;
          }
          throw e;
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async syncOnce(installationId: string): Promise<SettingsSyncResult> {
    const config = this.deps.getConfig();
    if (!config.code || !config.folderPath) {
      throw new Error(SETTINGS_SYNC_ERROR_NOT_CONFIGURED);
    }
    const installation = this.deps.getInstallations().find((inst) => inst.id === installationId);
    if (!installation) {
      throw new Error(`Installation does not exist: ${installationId}`);
    }
    // The game rewrites WTF when it exits, which would undo whatever sync wrote meanwhile
    if (await this.deps.isGameRunning()) {
      throw new Error(SETTINGS_SYNC_ERROR_GAME_RUNNING);
    }

    const keys = deriveSyncKeys(config.code);
    const transport = this.deps.getTransport(config.folderPath);
    const clientType = WowClientType[installation.clientType];
    const namespace = `${keys.vaultId}/${opaqueName(keys, `game:${clientType}`)}`;
    const manifestName = `${namespace}/manifest`;
    const manifestContext = `manifest:${clientType}`;
    const wtfPath = path.join(path.dirname(installation.location), "WTF");
    const now = this.deps.now();

    const sealedManifest = await transport.read(manifestName);
    const remoteManifest = sealedManifest
      ? (JSON.parse(open(keys, sealedManifest, manifestContext).toString("utf8")) as SyncManifest)
      : undefined;
    const firstDevice = !remoteManifest;

    const state = await this.readLocalState(installationId, keys.vaultId, transport.location);
    const local = await scanWtf(wtfPath);
    const remoteFiles = remoteManifest?.files ?? {};
    // An empty vault (new code, or the shared folder was wiped) is seeded from this device; using the
    // old base here would read every file as deleted elsewhere and delete it locally.
    const base = firstDevice ? {} : state?.base ?? {};
    const plan = planSync(local, remoteFiles, base, { joining: !state && !firstDevice, now });

    let backupPath: string | undefined;
    if (plan.download.length > 0 || plan.deleteLocal.length > 0) {
      backupPath = await this.deps.createBackup(installation, wtfPath);
    }

    // Contents are stored by content hash, so a file already uploaded by any device is reused
    for (const relativePath of plan.upload) {
      const entry = local[relativePath];
      const blobName = `${keys.vaultId}/blobs/${opaqueName(keys, `blob:${entry.hash}`)}`;
      if (await transport.exists(blobName)) {
        continue;
      }
      const content = await fsp.readFile(toLocalPath(wtfPath, relativePath));
      if (sha256(content) !== entry.hash) {
        // Changed while we were syncing; leave it for the next run
        this.deps.log.warn(`[settings-sync] ${relativePath} changed during sync, skipped`);
        continue;
      }
      await transport.write(blobName, seal(keys, content, `blob:${entry.hash}`));
    }

    for (const relativePath of plan.download) {
      const entry = remoteFiles[relativePath];
      if (!isLiveEntry(entry)) {
        continue;
      }
      await this.downloadFile(keys, transport, wtfPath, relativePath, entry.hash, entry.mtime);
    }

    for (const relativePath of plan.deleteLocal) {
      await fsp.rm(toLocalPath(wtfPath, relativePath), { force: true });
    }

    const devices = { ...(remoteManifest?.devices ?? {}) };
    devices[this.deps.deviceId] = {
      deviceId: this.deps.deviceId,
      deviceName: this.deps.deviceName,
      updatedAt: now,
      clientType,
      addons: this.deps.getAddons(installationId),
    };

    const nextFiles = applyPlanToRemote(local, remoteFiles, plan, { now });
    const changedRemote = plan.upload.length > 0 || plan.deleteRemote.length > 0 || firstDevice;
    const nextManifest: SyncManifest = {
      format: 1,
      version: (remoteManifest?.version ?? 0) + 1,
      updatedAt: now,
      updatedBy: this.deps.deviceId,
      files: nextFiles,
      devices,
    };

    // Optimistic lock: only write if nobody else wrote since we read
    const current = await transport.read(manifestName);
    const currentVersion = current
      ? (JSON.parse(open(keys, current, manifestContext).toString("utf8")) as SyncManifest).version
      : 0;
    if (currentVersion !== (remoteManifest?.version ?? 0)) {
      throw new ManifestChangedError();
    }
    await transport.write(manifestName, seal(keys, Buffer.from(JSON.stringify(nextManifest)), manifestContext));
    await this.writeLocalState(installationId, {
      vaultId: keys.vaultId,
      location: transport.location,
      base: baseFromRemote(nextFiles),
    });

    const changedLocal = plan.download.length > 0 || plan.deleteLocal.length > 0;
    const result: SettingsSyncResult = {
      installationId,
      finishedAt: now,
      outcome: firstDevice ? "first-device" : changedLocal || changedRemote ? "synced" : "no-changes",
      downloaded: plan.download.length,
      uploaded: plan.upload.length,
      deletedLocal: plan.deleteLocal.length,
      deletedRemote: plan.deleteRemote.length,
      conflicts: plan.conflicts,
      backupPath,
      otherDevices: Object.values(devices)
        .filter((device) => device.deviceId !== this.deps.deviceId)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    };
    this.deps.log.info(
      `[settings-sync] ${clientType}: ${result.outcome}, down ${result.downloaded}, up ${result.uploaded}, ` +
        `deleted ${result.deletedLocal}/${result.deletedRemote}, conflicts ${result.conflicts.length}`,
    );
    return result;
  }

  private async downloadFile(
    keys: SyncKeys,
    transport: SyncTransport,
    wtfPath: string,
    relativePath: string,
    hash: string,
    mtime: number,
  ): Promise<void> {
    const sealed = await transport.read(`${keys.vaultId}/blobs/${opaqueName(keys, `blob:${hash}`)}`);
    if (!sealed) {
      throw new Error(`Sync data is missing a file, it may still be uploading: ${relativePath}`);
    }
    const content = open(keys, sealed, `blob:${hash}`);
    if (sha256(content) !== hash) {
      throw new Error(`Sync data is corrupt for ${relativePath}`);
    }

    const target = toLocalPath(wtfPath, relativePath);
    const temp = `${target}${LOCAL_TEMP_SUFFIX}`;
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(temp, content);
    // Keep the original time, so "newest wins" compares when it was edited, not when it arrived
    const time = new Date(mtime);
    await fsp.utimes(temp, time, time);
    await fsp.rename(temp, target);
  }

  private statePath(installationId: string): string {
    return path.join(this.deps.stateFolderPath, `${installationId}.json`);
  }

  /** undefined when this installation never synced with this vault in this folder, which makes it join */
  private async readLocalState(
    installationId: string,
    vaultId: string,
    location: string,
  ): Promise<LocalState | undefined> {
    try {
      const state = JSON.parse(await fsp.readFile(this.statePath(installationId), "utf8")) as LocalState;
      if (state.vaultId !== vaultId || (state.location !== undefined && state.location !== location)) {
        return undefined;
      }
      return state;
    } catch {
      return undefined;
    }
  }

  private async writeLocalState(installationId: string, state: LocalState): Promise<void> {
    await fsp.mkdir(this.deps.stateFolderPath, { recursive: true });
    const target = this.statePath(installationId);
    await fsp.writeFile(`${target}.tmp`, JSON.stringify(state));
    await fsp.rename(`${target}.tmp`, target);
  }
}

class ManifestChangedError extends Error {}

function sha256(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function toLocalPath(wtfPath: string, relativePath: string): string {
  const resolved = path.resolve(wtfPath, ...relativePath.split("/"));
  // A manifest is only trusted as far as the key is; still never write outside WTF
  if (!resolved.startsWith(path.resolve(wtfPath) + path.sep)) {
    throw new Error(`Refusing a path outside WTF: ${relativePath}`);
  }
  return resolved;
}

/** Hashes every file sync carries; a missing WTF folder is simply empty */
export async function scanWtf(wtfPath: string): Promise<LocalFiles> {
  const files: LocalFiles = {};

  async function walk(dirPath: string, prefix: string): Promise<void> {
    let entries: import("fs").Dirent[];
    try {
      entries = await fsp.readdir(dirPath, { withFileTypes: true });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      throw e;
    }

    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, relativePath);
        continue;
      }
      if (!entry.isFile() || !isSyncedPath(relativePath)) {
        continue;
      }
      const stats = await fsp.stat(fullPath);
      if (stats.size > MAX_SYNC_FILE_BYTES) {
        continue;
      }
      const content = await fsp.readFile(fullPath);
      files[relativePath] = { hash: sha256(content), mtime: Math.floor(stats.mtimeMs), size: stats.size };
    }
  }

  await walk(wtfPath, "");
  return files;
}
