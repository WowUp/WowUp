import AdmZip = require("adm-zip");
import { createHash, randomUUID } from "crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

import {
  BundleManifest,
  compareVersions,
  hashBundleDirectory,
  sha256Hex,
  verifyManifest,
} from "../contract/bundle-manifest";
import { BundleUpdateReady } from "../contract/shell-api";
import { BundleLoaderOptions, getDownloadedStatus, recordRevoked } from "./bundle-loader";

// Checks for, downloads and stages newer app bundles, see "Storage & delivery" and Phase 5 in
// wowup-electron/SHELL_BUNDLE_PLAN.md. The shell owns this, not the bundle, so a broken bundle can't break its
// own way out. A staged bundle is loaded by the next launch; nothing here touches the running one. No Electron
// imports: fetch and the log are passed in, so it can be tested against plain folders.

export const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
/** How long to wait for the app to say which channel it's on before using the loaded bundle's */
export const CHANNEL_FALLBACK_MS = 30 * 1000;

const MANIFEST_TIMEOUT_MS = 30 * 1000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;

export interface UpdaterLog {
  info(...params: unknown[]): void;
  warn(...params: unknown[]): void;
}

export type FetchFn = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<Pick<Response, "status" | "ok" | "headers" | "json" | "arrayBuffer">>;

export interface BundleUpdaterOptions {
  loader: BundleLoaderOptions;
  /** Hosts serving <flavor>/<channel>/shell-api-<N>.json, tried in order */
  baseUrls: string[];
  /** The version of the bundle the shell loaded */
  currentVersion: string;
  fetch: FetchFn;
  log: UpdaterLog;
}

export type UpdateDecision = { install: true; important: boolean } | { install: false; reason: string };

interface UpdaterState {
  /** Random, only used to place this install in a rollout */
  installId: string;
  /** The last accepted manifest's issuedAt, by channel */
  issuedAt: Record<string, string>;
}

interface CachedManifest {
  etag?: string;
  lastModified?: string;
  manifest: BundleManifest;
}

/** Why a channel manifest can't be used at all, or undefined if it can */
export function checkManifest(
  manifest: BundleManifest,
  loader: BundleLoaderOptions,
  channel: string,
  lastIssuedAt: string | undefined,
): string | undefined {
  if (!verifyManifest(manifest, loader.trustedKeys)) {
    return `signature doesn't verify (key "${String(manifest.keyId)}")`;
  }
  if (manifest.flavor !== loader.flavor || manifest.shellApi !== loader.shellApi || manifest.channel !== channel) {
    return `it's for ${manifest.flavor} ${manifest.channel} shell API ${manifest.shellApi}`;
  }
  const issuedAt = Date.parse(manifest.issuedAt);
  if (Number.isNaN(issuedAt)) {
    return `issuedAt "${manifest.issuedAt}" isn't a date`;
  }
  // Blocks a host replaying an older, validly signed manifest
  if (lastIssuedAt !== undefined && issuedAt < Date.parse(lastIssuedAt)) {
    return `issued ${manifest.issuedAt}, before the last accepted ${lastIssuedAt}`;
  }
  return undefined;
}

/** Whether a usable manifest's bundle should be installed over the running one */
export function decideUpdate(manifest: BundleManifest, currentVersion: string, installId: string): UpdateDecision {
  const currentRevoked = manifest.revoked.includes(currentVersion);
  if (manifest.version === currentVersion) {
    return { install: false, reason: `${currentVersion} is already running` };
  }
  // Going back is only allowed off a revoked bundle, so a host can't push an old bundle with a known bug
  if (compareVersions(manifest.version, currentVersion) < 0 && !currentRevoked) {
    return { install: false, reason: `${manifest.version} is older than the running ${currentVersion}` };
  }
  if (!currentRevoked && rolloutBucket(installId, manifest.version) >= manifest.rolloutPercent) {
    return { install: false, reason: `${manifest.version} is rolled out to ${manifest.rolloutPercent}%, not here yet` };
  }
  return { install: true, important: currentRevoked };
}

/** 0-99, stable for an install and version. Salted with the version so the same installs aren't always first. */
export function rolloutBucket(installId: string, version: string): number {
  return createHash("sha256").update(`${installId}:${version}`).digest().readUInt32BE(0) % 100;
}

export class BundleUpdater {
  private _channel: string | undefined;
  private _ready: BundleUpdateReady | undefined;
  private readonly _listeners: Array<(update: BundleUpdateReady) => void> = [];
  private _checking: { channel: string; done: Promise<void> } | undefined;
  private readonly _manifests = new Map<string, CachedManifest>();

  public constructor(private readonly _options: BundleUpdaterOptions) {}

  /** Checks now and every CHECK_INTERVAL_MS; the first check waits for setChannel(), up to CHANNEL_FALLBACK_MS */
  public start(fallbackChannel: string): void {
    setTimeout(() => {
      if (this._channel === undefined) {
        this._options.log.info(`No update channel set by the app, using ${fallbackChannel}`);
        this.setChannel(fallbackChannel);
      }
    }, CHANNEL_FALLBACK_MS);
    setInterval(() => void this.checkNow(), CHECK_INTERVAL_MS);
  }

  /** Switching channels checks right away */
  public setChannel(channel: string): void {
    if (!/^[a-z]+$/.test(channel)) {
      this._options.log.warn(`Ignoring invalid update channel "${channel}"`);
      return;
    }
    if (channel !== this._channel) {
      this._channel = channel;
      void this.checkNow();
    }
  }

  /** Called once a bundle is staged, and right away if one already is */
  public onReady(listener: (update: BundleUpdateReady) => void): void {
    this._listeners.push(listener);
    if (this._ready !== undefined) {
      listener(this._ready);
    }
  }

  /** Never rejects: failures are logged and the next check tries again */
  public checkNow(): Promise<void> {
    if (this._channel === undefined) {
      return Promise.resolve();
    }
    if (this._checking !== undefined) {
      // A check of another channel is followed by one of the current channel
      const { channel, done } = this._checking;
      return channel === this._channel ? done : done.then(() => this.checkNow());
    }

    const channel = this._channel;
    const done = this.check(channel)
      .catch((e) => this._options.log.warn("Bundle update check failed", e))
      .finally(() => {
        this._checking = undefined;
      });
    this._checking = { channel, done };
    return done;
  }

  private async check(channel: string): Promise<void> {
    const { loader, currentVersion, log } = this._options;

    const manifest = await this.fetchManifest(channel);
    if (manifest === undefined) {
      return;
    }

    const state = readUpdaterState(loader.bundlesDir);
    const problem = checkManifest(manifest, loader, channel, state.issuedAt[channel]);
    if (problem !== undefined) {
      log.warn(`Ignoring the ${channel} bundle manifest: ${problem}`);
      return;
    }
    state.issuedAt[channel] = manifest.issuedAt;
    writeUpdaterState(loader.bundlesDir, state);
    recordRevoked(loader.bundlesDir, manifest.revoked);

    const decision = decideUpdate(manifest, currentVersion, state.installId);
    if ("reason" in decision) {
      log.info(`No bundle update: ${decision.reason}`);
      return;
    }

    const status = getDownloadedStatus(loader, manifest.version);
    if (status === "unusable") {
      log.warn(`Not installing bundle ${manifest.version}: it was set aside or revoked here`);
      return;
    }
    if (status === undefined) {
      await this.install(manifest);
    }

    log.info(`Bundle ${manifest.version} is ready${decision.important ? `, replacing revoked ${currentVersion}` : ""}`);
    this.notifyReady({ version: manifest.version, important: decision.important });
  }

  /** The channel's manifest from the first host that has it, or undefined (logged) if none does */
  private async fetchManifest(channel: string): Promise<BundleManifest | undefined> {
    const { loader, baseUrls, log } = this._options;

    for (const baseUrl of baseUrls) {
      const url = `${baseUrl}/${loader.flavor}/${channel}/shell-api-${loader.shellApi}.json`;
      const cached = this._manifests.get(url);
      const headers: Record<string, string> = {};
      if (cached?.etag !== undefined) {
        headers["If-None-Match"] = cached.etag;
      }
      if (cached?.lastModified !== undefined) {
        headers["If-Modified-Since"] = cached.lastModified;
      }

      try {
        const response = await this._options.fetch(url, { headers, signal: AbortSignal.timeout(MANIFEST_TIMEOUT_MS) });
        if (response.status === 304 && cached !== undefined) {
          return cached.manifest;
        }
        if (!response.ok) {
          log.warn(`Bundle manifest ${url}: HTTP ${response.status}`);
          continue;
        }

        const manifest = (await response.json()) as BundleManifest;
        this._manifests.set(url, {
          etag: response.headers.get("etag") ?? undefined,
          lastModified: response.headers.get("last-modified") ?? undefined,
          manifest,
        });
        return manifest;
      } catch (e) {
        log.warn(`Bundle manifest ${url}: ${(e as Error).message}`);
      }
    }
    return undefined;
  }

  /**
   * Downloads, checks and unpacks the bundle into <bundlesDir>/<version>/. The zip is only opened once its hash
   * matches the signed manifest, and the folder only gets its final name once its contents match too.
   */
  private async install(manifest: BundleManifest): Promise<void> {
    const { bundlesDir } = this._options.loader;
    const zip = await this.download(manifest);

    const staging = join(bundlesDir, ".staging");
    rmSync(staging, { recursive: true, force: true });
    mkdirSync(join(staging, "bundle"), { recursive: true });
    new AdmZip(zip).extractAllTo(join(staging, "bundle"), true);
    if (hashBundleDirectory(join(staging, "bundle")) !== manifest.contentSha256) {
      rmSync(staging, { recursive: true, force: true });
      throw new Error(`Bundle ${manifest.version}'s files don't match its manifest`);
    }
    writeFileSync(join(staging, "manifest.json"), JSON.stringify(manifest, null, 2));

    const target = join(bundlesDir, manifest.version);
    rmSync(target, { recursive: true, force: true });
    renameSync(staging, target);
  }

  private async download(manifest: BundleManifest): Promise<Buffer> {
    for (const url of manifest.urls) {
      try {
        this._options.log.info(`Downloading bundle ${manifest.version} from ${url}`);
        const response = await this._options.fetch(url, {
          headers: {},
          signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
        });
        if (!response.ok) {
          this._options.log.warn(`Bundle download ${url}: HTTP ${response.status}`);
          continue;
        }
        const zip = Buffer.from(await response.arrayBuffer());
        if (sha256Hex(zip) !== manifest.sha256) {
          this._options.log.warn(`Bundle download ${url}: doesn't match the manifest's sha256`);
          continue;
        }
        return zip;
      } catch (e) {
        this._options.log.warn(`Bundle download ${url}: ${(e as Error).message}`);
      }
    }
    throw new Error(`Couldn't download bundle ${manifest.version} from any of its URLs`);
  }

  private notifyReady(update: BundleUpdateReady): void {
    if (this._ready?.version === update.version && this._ready.important === update.important) {
      return;
    }
    this._ready = update;
    for (const listener of this._listeners) {
      listener(update);
    }
  }
}

function readUpdaterState(bundlesDir: string): UpdaterState {
  let state: Partial<UpdaterState> = {};
  try {
    state = JSON.parse(readFileSync(join(bundlesDir, "updater.json"), "utf8")) as Partial<UpdaterState>;
  } catch {
    // First check, or unreadable: start over with a new install ID
  }

  // Saved with the first accepted manifest, before it's used for the rollout
  return {
    installId: typeof state.installId === "string" ? state.installId : randomUUID(),
    issuedAt: typeof state.issuedAt === "object" && state.issuedAt !== null ? state.issuedAt : {},
  };
}

/** Best effort, like the loader's state */
function writeUpdaterState(bundlesDir: string, state: UpdaterState): void {
  try {
    mkdirSync(bundlesDir, { recursive: true });
    writeFileSync(join(bundlesDir, "updater.json"), JSON.stringify(state, null, 2));
  } catch {
    // Without it the install ID changes and old manifests aren't refused; updates still work
  }
}
