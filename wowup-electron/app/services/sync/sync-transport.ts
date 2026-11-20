import * as fs from "fs";
import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";

import { SETTINGS_SYNC_ERROR_FOLDER_MISSING } from "../../../src/common/models/settings-sync";

/**
 * Where a vault's sealed objects live. Names are "/"-separated and opaque (see `opaqueName`), and
 * start with the vault id; content is already encrypted, so a transport needs no trust: a shared
 * folder today, a relay server later.
 */
export interface SyncTransport {
  /** undefined when there is no object by that name */
  read(name: string): Promise<Buffer | undefined>;
  write(name: string, data: Buffer): Promise<void>;
  exists(name: string): Promise<boolean>;
  /** Where this vault lives; a device that moves to another location joins it afresh */
  locate(vaultId: string): Promise<string>;
  /** How many other vaults (other sync codes) share this vault's location */
  countOtherVaults(vaultId: string): Promise<number>;
}

/** The folder created inside the one the user picks, so the vault never mixes with their own files */
export const SYNC_FOLDER_NAME = "WowUp Sync";

/**
 * iCloud Drive, when this device has it: the same folder on every Mac (and on Windows with iCloud),
 * so devices meet without the user picking anything
 */
export function getDefaultSyncFolder(): string | undefined {
  const candidates =
    process.platform === "darwin"
      ? [path.join(os.homedir(), "Library", "Mobile Documents", "com~apple~CloudDocs")]
      : process.platform === "win32"
        ? [path.join(os.homedir(), "iCloudDrive")]
        : [];
  return candidates.find((dir) => fs.existsSync(dir));
}

const VAULT_ID_PATTERN = /^[0-9a-f]{32}$/;
/** How deep below the picked folder to look for an existing "WowUp Sync" folder */
const SEARCH_DEPTH = 3;
const SEARCH_MAX_FOLDERS = 2_000;

/**
 * A folder the user's devices already share: iCloud Drive, Dropbox, OneDrive, a NAS. Writes go to
 * a temporary name first, so another device never picks up half a file.
 *
 * Devices don't have to pick exactly the same folder: the vault is looked up in the picked folder,
 * the "WowUp Sync" folder it is in, or a "WowUp Sync" folder a few levels below it. Only when the
 * vault is in none of them is a new one started in "<picked>/WowUp Sync".
 */
export class FolderTransport implements SyncTransport {
  private readonly chosenFolder: string;
  private readonly roots = new Map<string, Promise<string>>();

  public constructor(chosenFolder: string) {
    this.chosenFolder = path.resolve(chosenFolder);
  }

  public async read(name: string): Promise<Buffer | undefined> {
    await this.assertFolder();
    const filePath = await this.resolve(name);
    try {
      return await fsp.readFile(filePath);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
        throw e;
      }
    }

    // iCloud Drive can keep a file in the cloud only, leaving a ".<name>.icloud" placeholder
    const placeholder = path.join(path.dirname(filePath), `.${path.basename(filePath)}.icloud`);
    if (await pathExists(placeholder)) {
      throw new Error(`The sync file is not downloaded to this Mac yet: ${filePath}`);
    }
    return undefined;
  }

  public async write(name: string, data: Buffer): Promise<void> {
    await this.assertFolder();
    const filePath = await this.resolve(name);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fsp.writeFile(tempPath, data);
    await fsp.rename(tempPath, filePath);
  }

  public async exists(name: string): Promise<boolean> {
    await this.assertFolder();
    const filePath = await this.resolve(name);
    return (
      (await pathExists(filePath)) ||
      pathExists(path.join(path.dirname(filePath), `.${path.basename(filePath)}.icloud`))
    );
  }

  public async locate(vaultId: string): Promise<string> {
    await this.assertFolder();
    return this.rootFor(vaultId);
  }

  public async countOtherVaults(vaultId: string): Promise<number> {
    const root = await this.locate(vaultId);
    const entries = await fsp.readdir(root, { withFileTypes: true }).catch((): fs.Dirent[] => []);
    return entries.filter((e) => e.isDirectory() && VAULT_ID_PATTERN.test(e.name) && e.name !== vaultId).length;
  }

  /** The chosen folder must be there; a vanished cloud folder must not quietly start a new vault */
  private async assertFolder(): Promise<void> {
    if (!(await pathExists(this.chosenFolder))) {
      throw new Error(SETTINGS_SYNC_ERROR_FOLDER_MISSING);
    }
  }

  private async resolve(name: string): Promise<string> {
    const parts = name.split("/");
    if (parts.some((part) => !/^[a-z0-9-]+$/i.test(part))) {
      throw new Error(`Invalid sync object name: ${name}`);
    }
    return path.join(await this.rootFor(parts[0]), ...parts);
  }

  private rootFor(vaultId: string): Promise<string> {
    const known = this.roots.get(vaultId);
    if (known !== undefined) {
      return known;
    }
    const root = findVaultRoot(this.chosenFolder, vaultId);
    this.roots.set(vaultId, root);
    return root;
  }
}

/** Outermost first, so a vault nested inside another "WowUp Sync" by mistake loses to the real one */
export async function findVaultRoot(chosenFolder: string, vaultId: string): Promise<string> {
  const candidates: string[] = [];

  // The picked folder is (inside) a "WowUp Sync" folder: the outermost one is the vault folder
  const ancestors: string[] = [];
  for (let dir = chosenFolder; path.dirname(dir) !== dir; dir = path.dirname(dir)) {
    ancestors.unshift(dir);
  }
  candidates.push(...ancestors.filter((dir) => path.basename(dir) === SYNC_FOLDER_NAME));

  const defaultRoot = candidates[0] ?? path.join(chosenFolder, SYNC_FOLDER_NAME);
  candidates.push(defaultRoot, ...(await findSyncFolders(chosenFolder)));

  for (const candidate of candidates) {
    if (await pathExists(path.join(candidate, vaultId))) {
      return candidate;
    }
  }
  return defaultRoot;
}

/** "WowUp Sync" folders below `folder`, breadth first (so shallower ones come first) */
async function findSyncFolders(folder: string): Promise<string[]> {
  const found: string[] = [];
  let level = [folder];
  let visited = 0;
  for (let depth = 0; depth < SEARCH_DEPTH && level.length > 0 && visited < SEARCH_MAX_FOLDERS; depth++) {
    const next: string[] = [];
    for (const dir of level) {
      if (++visited > SEARCH_MAX_FOLDERS) {
        break;
      }
      const entries = await fsp.readdir(dir, { withFileTypes: true }).catch((): fs.Dirent[] => []);
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith(".") || VAULT_ID_PATTERN.test(entry.name)) {
          continue;
        }
        const full = path.join(dir, entry.name);
        if (entry.name === SYNC_FOLDER_NAME) {
          found.push(full);
        } else {
          next.push(full);
        }
      }
    }
    level = next;
  }
  return found;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}
