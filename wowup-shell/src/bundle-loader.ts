import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

import {
  BundleManifest,
  BundlePublicKeys,
  compareVersions,
  hashBundleDirectory,
  verifyManifest,
} from "../contract/bundle-manifest";

// Picks the app bundle to load and keeps track of how it went, see "Boot sequence" and Phase 4 in
// wowup-electron/SHELL_BUNDLE_PLAN.md. No Electron imports, so it can be tested with plain folders.
//
// Downloaded bundles live in <bundlesDir>/<version>/, each holding bundle/ (the files) and manifest.json, next
// to <bundlesDir>/state.json. The bundle built into the installer is a candidate too, and is checked the same
// way: the install folder is writable by anything running as the user.

/** A bundle that fails to mark itself healthy this many starts in a row is set aside */
export const MAX_UNHEALTHY_BOOTS = 2;

export interface BundleLoaderOptions {
  bundlesDir: string;
  builtIn: { root: string; manifestPath: string };
  trustedKeys: BundlePublicKeys;
  shellApi: number;
  flavor: string;
}

export interface SelectedBundle {
  source: "downloaded" | "builtin";
  root: string;
  manifest: BundleManifest;
}

export interface Rejection {
  root: string;
  reason: string;
}

export interface Selection {
  bundle: SelectedBundle | undefined;
  /** Every candidate passed over, and why, for the log */
  rejected: Rejection[];
}

interface BundleState {
  /** Downloaded versions set aside after failing to start */
  quarantined: string[];
  /** The last downloaded version that started cleanly */
  lastGood?: string;
  /** The bundle being started, and how many starts in a row it has had without marking itself healthy */
  booting?: { id: string; attempts: number };
}

interface Candidate {
  source: "downloaded" | "builtin";
  root: string;
  manifestPath: string;
  /** The version folder's name, for downloaded bundles */
  folder?: string;
  /** What the manifest claims, unverified; only used to order candidates */
  claimedVersion: string | undefined;
}

export function selectBundle(options: BundleLoaderOptions): Selection {
  const state = readState(options.bundlesDir);
  const rejected: Rejection[] = [];

  for (const candidate of listCandidates(options)) {
    const id = bundleId(candidate);

    if (candidate.source === "downloaded" && state.quarantined.includes(candidate.folder ?? "")) {
      rejected.push({ root: candidate.root, reason: "set aside after failing to start" });
      continue;
    }

    // The built-in bundle is never set aside: there's nothing to fall back to after it
    if (
      candidate.source === "downloaded" &&
      state.booting?.id === id &&
      state.booting.attempts >= MAX_UNHEALTHY_BOOTS
    ) {
      state.quarantined.push(candidate.folder ?? "");
      state.booting = undefined;
      rejected.push({ root: candidate.root, reason: `didn't start ${MAX_UNHEALTHY_BOOTS} times in a row` });
      continue;
    }

    const result = checkCandidate(candidate, options);
    if (typeof result === "string") {
      rejected.push({ root: candidate.root, reason: result });
      continue;
    }

    state.booting = { id, attempts: state.booting?.id === id ? state.booting.attempts + 1 : 1 };
    writeState(options.bundlesDir, state);
    return { bundle: { source: candidate.source, root: candidate.root, manifest: result }, rejected };
  }

  writeState(options.bundlesDir, state);
  return { bundle: undefined, rejected };
}

/**
 * Called once the loaded bundle's window is ready: clears the boot count, remembers it as the last good bundle,
 * and removes downloaded bundles that are no longer needed. Kept: this one, the previous good one (to fall back
 * to), and anything newer that isn't set aside (a download waiting for a restart).
 */
export function markBundleHealthy(options: BundleLoaderOptions, bundle: SelectedBundle): void {
  const state = readState(options.bundlesDir);
  state.booting = undefined;

  if (bundle.source === "downloaded") {
    const keep = new Set([bundle.manifest.version, state.lastGood]);
    state.lastGood = bundle.manifest.version;

    for (const folder of listFolders(options.bundlesDir)) {
      const newer = isVersion(folder) && compareVersions(folder, bundle.manifest.version) > 0;
      if (keep.has(folder) || (newer && !state.quarantined.includes(folder))) {
        continue;
      }
      rmSync(join(options.bundlesDir, folder), { recursive: true, force: true });
    }
  }

  writeState(options.bundlesDir, state);
}

/** Candidates newest first by what their manifests claim; the built-in bundle wins a tie */
function listCandidates(options: BundleLoaderOptions): Candidate[] {
  const downloaded: Candidate[] = listFolders(options.bundlesDir).map((folder) => {
    const manifestPath = join(options.bundlesDir, folder, "manifest.json");
    return {
      source: "downloaded",
      root: join(options.bundlesDir, folder, "bundle"),
      manifestPath,
      folder,
      claimedVersion: readManifest(manifestPath)?.version,
    };
  });
  const builtIn: Candidate = {
    source: "builtin",
    root: options.builtIn.root,
    manifestPath: options.builtIn.manifestPath,
    claimedVersion: readManifest(options.builtIn.manifestPath)?.version,
  };

  return [builtIn, ...downloaded].sort((a, b) => {
    const order = compareClaimed(b.claimedVersion, a.claimedVersion);
    return order !== 0 ? order : a.source === "builtin" ? -1 : b.source === "builtin" ? 1 : 0;
  });
}

/** The verified manifest, or why the candidate can't be loaded */
function checkCandidate(candidate: Candidate, options: BundleLoaderOptions): BundleManifest | string {
  const manifest = readManifest(candidate.manifestPath);
  if (manifest === undefined) {
    return "manifest missing or unreadable";
  }
  if (!verifyManifest(manifest, options.trustedKeys)) {
    return `manifest signature doesn't verify (key "${String(manifest.keyId)}")`;
  }
  if (manifest.flavor !== options.flavor) {
    return `built for the ${manifest.flavor} flavor, not ${options.flavor}`;
  }
  if (manifest.shellApi !== options.shellApi) {
    return `needs shell API ${manifest.shellApi}, this shell has ${options.shellApi}`;
  }
  if (candidate.source === "downloaded" && manifest.version !== candidate.folder) {
    return `manifest is for ${manifest.version}, not ${String(candidate.folder)}`;
  }
  if (!existsSync(candidate.root)) {
    return "bundle files missing";
  }
  if (hashBundleDirectory(candidate.root) !== manifest.contentSha256) {
    return "bundle files don't match the manifest";
  }
  return manifest;
}

function bundleId(candidate: Candidate): string {
  return candidate.source === "builtin" ? "builtin" : `downloaded:${String(candidate.folder)}`;
}

function compareClaimed(a: string | undefined, b: string | undefined): number {
  const aValid = a !== undefined && isVersion(a);
  const bValid = b !== undefined && isVersion(b);
  if (!aValid || !bValid) {
    return Number(aValid) - Number(bValid);
  }
  return compareVersions(a, b);
}

function isVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(value);
}

function listFolders(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function readManifest(path: string): BundleManifest | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as BundleManifest;
  } catch {
    return undefined;
  }
}

function readState(bundlesDir: string): BundleState {
  try {
    const state = JSON.parse(readFileSync(join(bundlesDir, "state.json"), "utf8")) as Partial<BundleState>;
    return { ...state, quarantined: Array.isArray(state.quarantined) ? state.quarantined : [] };
  } catch {
    return { quarantined: [] };
  }
}

/** Best effort: failing to save the state (a read-only or full disk) must not stop the app from starting */
function writeState(bundlesDir: string, state: BundleState): void {
  try {
    mkdirSync(bundlesDir, { recursive: true });
    writeFileSync(join(bundlesDir, "state.json"), JSON.stringify(state, null, 2));
  } catch {
    // Without the state, a bundle that keeps failing is retried rather than set aside; still starts
  }
}
