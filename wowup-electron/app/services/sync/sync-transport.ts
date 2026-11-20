import * as fsp from "fs/promises";
import * as path from "path";

import { SETTINGS_SYNC_ERROR_FOLDER_MISSING } from "../../../src/common/models/settings-sync";

/**
 * Where a vault's sealed objects live. Names are "/"-separated and opaque (see `opaqueName`);
 * content is already encrypted, so a transport needs no trust: a shared folder today, a relay
 * server later.
 */
export interface SyncTransport {
  /** undefined when there is no object by that name */
  read(name: string): Promise<Buffer | undefined>;
  write(name: string, data: Buffer): Promise<void>;
  exists(name: string): Promise<boolean>;
}

/** The folder created inside the one the user picks, so the vault never mixes with their own files */
export const SYNC_FOLDER_NAME = "WowUp Sync";

/**
 * A folder the user's devices already share: iCloud Drive, Dropbox, OneDrive, a NAS. Writes go to
 * a temporary name first, so another device never picks up half a file.
 */
export class FolderTransport implements SyncTransport {
  private readonly root: string;

  public constructor(private readonly chosenFolder: string) {
    this.root = path.join(chosenFolder, SYNC_FOLDER_NAME);
  }

  public async read(name: string): Promise<Buffer | undefined> {
    await this.assertFolder();
    const filePath = this.resolve(name);
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
    const filePath = this.resolve(name);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fsp.writeFile(tempPath, data);
    await fsp.rename(tempPath, filePath);
  }

  public async exists(name: string): Promise<boolean> {
    await this.assertFolder();
    const filePath = this.resolve(name);
    return (
      (await pathExists(filePath)) ||
      pathExists(path.join(path.dirname(filePath), `.${path.basename(filePath)}.icloud`))
    );
  }

  /** The chosen folder must be there; a vanished cloud folder must not quietly start a new vault */
  private async assertFolder(): Promise<void> {
    if (!(await pathExists(this.chosenFolder))) {
      throw new Error(SETTINGS_SYNC_ERROR_FOLDER_MISSING);
    }
  }

  private resolve(name: string): string {
    const parts = name.split("/");
    if (parts.some((part) => !/^[a-z0-9-]+$/i.test(part))) {
      throw new Error(`Invalid sync object name: ${name}`);
    }
    return path.join(this.root, ...parts);
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}
