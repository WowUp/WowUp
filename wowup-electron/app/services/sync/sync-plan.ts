/**
 * What settings sync copies, and how two sides are merged. Pure: no file system, no clock.
 *
 * Paths are relative to the installation's WTF folder and always use "/".
 */

/** Files bigger than this are skipped rather than uploaded: a runaway SavedVariables shouldn't fill the vault */
export const MAX_SYNC_FILE_BYTES = 64 * 1024 * 1024;

const EXCLUDED_NAMES = new Set([
  // graphics, resolution and other per-machine game options
  "config.wtf",
  "gamepadconfig_default.json",
  "gamecontrollerdb.txt",
  "cache.md5",
  ".ds_store",
  "thumbs.db",
  "desktop.ini",
  // written into WTF by WowUp's own backup while it zips
  "wowup-meta.json",
]);

const EXCLUDED_SUFFIXES = [".bak", ".old", ".tmp", ".wowup-sync-tmp"];

/** Whether a WTF-relative path is part of what settings sync carries between devices */
export function isSyncedPath(relativePath: string): boolean {
  const parts = relativePath.split("/");
  const name = parts[parts.length - 1].toLowerCase();
  if (EXCLUDED_NAMES.has(name) || EXCLUDED_SUFFIXES.some((suffix) => name.endsWith(suffix))) {
    return false;
  }

  const top = parts[0].toLowerCase();
  // Account/<account>/... holds SavedVariables, macros, bindings, layout and chat per account and
  // character; the root SavedVariables holds the global addon enable list.
  return (top === "account" && parts.length >= 3) || (top === "savedvariables" && parts.length === 2);
}

export interface SyncFileState {
  /** sha256 of the content, hex */
  hash: string;
  /** Last modification, ms since epoch */
  mtime: number;
  size: number;
}

/** A path the remote no longer has, kept so other devices delete it too instead of uploading it again */
export interface SyncTombstone {
  deleted: true;
  /** When the deletion was first seen, ms since epoch */
  mtime: number;
}

export type RemoteFileEntry = SyncFileState | SyncTombstone;

export function isLiveEntry(entry: RemoteFileEntry | undefined): entry is SyncFileState {
  return !!entry && !("deleted" in entry && entry.deleted);
}

export type LocalFiles = { [path: string]: SyncFileState };
export type RemoteFiles = { [path: string]: RemoteFileEntry };
/** Content hash per path at the end of this device's last sync with this vault */
export type BaseFiles = { [path: string]: string };

export interface SyncPlan {
  /** Remote copy replaces (or creates) the local file */
  download: string[];
  /** Local copy replaces (or creates) the remote file */
  upload: string[];
  deleteLocal: string[];
  /** The remote file becomes a tombstone */
  deleteRemote: string[];
  /** Changed on both sides since the last sync; listed in one of the arrays above as well */
  conflicts: string[];
}

export interface PlanOptions {
  /**
   * This device has never synced with the vault. Its files are probably fresh defaults, so when
   * both sides have a path the vault's copy wins regardless of age; files only this device has
   * are still uploaded.
   */
  joining: boolean;
  /** Used as the time of local deletions, which leave no file to read a time from */
  now: number;
}

function remoteHash(entry: RemoteFileEntry | undefined): string | undefined {
  return isLiveEntry(entry) ? entry.hash : undefined;
}

/**
 * Three-way merge of the local files, the vault's files, and what both agreed on last time.
 * A side that is unchanged since the base takes the other side's change; when both changed,
 * the newest wins (or the vault, while joining).
 */
export function planSync(local: LocalFiles, remote: RemoteFiles, base: BaseFiles, options: PlanOptions): SyncPlan {
  const plan: SyncPlan = { download: [], upload: [], deleteLocal: [], deleteRemote: [], conflicts: [] };
  const paths = new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(base)]);

  for (const path of [...paths].sort()) {
    if (!isSyncedPath(path)) {
      continue;
    }

    const localHash = local[path]?.hash;
    const remoteEntry = remote[path];
    const rHash = remoteHash(remoteEntry);
    const baseHash = options.joining ? undefined : base[path];

    if (localHash === rHash) {
      continue;
    }

    const takeRemote = () => (rHash === undefined ? plan.deleteLocal.push(path) : plan.download.push(path));
    const takeLocal = () => (localHash === undefined ? plan.deleteRemote.push(path) : plan.upload.push(path));

    if (remoteEntry === undefined) {
      // The vault never had this file (not even as a deletion): it's new to the vault, never a reason
      // to delete it here. Happens when a device moves to another vault folder.
      plan.upload.push(path);
      continue;
    }

    if (localHash === baseHash) {
      // Only the remote changed. Also covers a path neither side had at the base.
      if (localHash === undefined && rHash === undefined) {
        continue;
      }
      takeRemote();
      continue;
    }

    if (rHash === baseHash) {
      takeLocal();
      continue;
    }

    // Both sides changed it
    if (options.joining) {
      if (rHash === undefined) {
        // The vault never had it or deleted it; a device that's joining keeps its own file
        plan.upload.push(path);
      } else {
        plan.conflicts.push(path);
        plan.download.push(path);
      }
      continue;
    }

    plan.conflicts.push(path);
    const localTime = local[path]?.mtime ?? options.now;
    const remoteTime = remoteEntry?.mtime ?? 0;
    if (remoteTime > localTime) {
      takeRemote();
    } else {
      takeLocal();
    }
  }

  return plan;
}

/** The vault's file list after this device applied and pushed a plan */
export function applyPlanToRemote(
  local: LocalFiles,
  remote: RemoteFiles,
  plan: SyncPlan,
  options: Pick<PlanOptions, "now">,
): RemoteFiles {
  const next: RemoteFiles = { ...remote };
  for (const path of plan.upload) {
    next[path] = { ...local[path] };
  }
  for (const path of plan.deleteRemote) {
    next[path] = { deleted: true, mtime: options.now };
  }
  return next;
}

/** The base to store for next time: the content hash per path both sides now agree on */
export function baseFromRemote(remote: RemoteFiles): BaseFiles {
  const base: BaseFiles = {};
  for (const [path, entry] of Object.entries(remote)) {
    if (isLiveEntry(entry)) {
      base[path] = entry.hash;
    }
  }
  return base;
}
