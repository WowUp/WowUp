import * as fsp from "fs/promises";

import { exists as fileExists, readDirRecursive } from "../../file.utils";

export interface ScanLogger {
  debug: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/** The two fingerprint algorithms, kept injectable so a scan can be tested without the native addon. */
export interface FileHashAlgorithms {
  md5: (buffer: Buffer) => string;
  /** Murmur2, via the native addon. Also used on a plain string, encoded as ascii. */
  murmur: (buffer: Buffer) => number;
}

/** Which fingerprints this run will actually be asked for, so no file is hashed for nothing. */
export interface HashesNeeded {
  md5: boolean;
  murmur: boolean;
}

export interface FolderScanIo {
  listFiles: (folderPath: string) => Promise<string[]>;
  readFile: (filePath: string) => Promise<Buffer>;
  exists: (filePath: string) => Promise<boolean>;
}

export interface FolderScanContextDeps {
  hashes: FileHashAlgorithms;
  needed: HashesNeeded;
  log: ScanLogger;
  io?: Partial<FolderScanIo>;
}

interface FileHashes {
  md5?: string;
  murmur?: number;
}

const defaultIo: FolderScanIo = {
  listFiles: (folderPath) => readDirRecursive(folderPath),
  readFile: (filePath) => fsp.readFile(filePath),
  exists: (filePath) => fileExists(filePath),
};

/**
 * One addon folder's worth of shared filesystem work.
 *
 * Both fingerprint scanners walk the same tree and hash the same files, so without this each of
 * them re-walks the folder and re-reads every file it matched. The context reads each file once and
 * derives both fingerprints from that single buffer, which is what the two scanners then share.
 *
 * Promises are what get memoized, not values, so two scanners asking for the same file at the same
 * time still only cause one read.
 */
export class FolderScanContext {
  private readonly _io: FolderScanIo;
  private readonly _listings = new Map<string, Promise<string[]>>();
  private readonly _hashes = new Map<string, Promise<FileHashes>>();

  /**
   * Buffers for the toc and xml files whose text has to be parsed for includes. These are small and
   * are about to be hashed as well, so holding them saves that second read. Nothing else is kept.
   */
  private readonly _parsedBuffers = new Map<string, Promise<Buffer>>();

  /** Reads actually issued to the filesystem, so a test can prove the sharing works. */
  private _fileReadCount = 0;

  public readonly log: ScanLogger;

  public constructor(private readonly _deps: FolderScanContextDeps) {
    this._io = { ...defaultIo, ..._deps.io };
    this.log = _deps.log;
  }

  public get fileReadCount(): number {
    return this._fileReadCount;
  }

  public listFiles(folderPath: string): Promise<string[]> {
    return this.memoize(this._listings, folderPath, () => this._io.listFiles(folderPath));
  }

  public exists(filePath: string): Promise<boolean> {
    return this._io.exists(filePath);
  }

  /** Only ever wanted for toc and xml files, whose contents are small. */
  public async readText(filePath: string): Promise<string> {
    const buffer = await this.memoize(this._parsedBuffers, filePath, () => this.readFile(filePath));
    return buffer.toString("utf-8");
  }

  public async hashFileMd5(filePath: string): Promise<string> {
    const hashes = await this.hashFile(filePath);
    if (hashes.md5 === undefined) {
      throw new Error(`md5 was not requested for this scan: ${filePath}`);
    }
    return hashes.md5;
  }

  public async hashFileMurmur(filePath: string): Promise<number> {
    const hashes = await this.hashFile(filePath);
    if (hashes.murmur === undefined) {
      throw new Error(`murmur was not requested for this scan: ${filePath}`);
    }
    return hashes.murmur;
  }

  public hashStringMd5(value: string): string {
    return this._deps.hashes.md5(Buffer.from(value));
  }

  public hashStringMurmur(value: string): number {
    return this._deps.hashes.murmur(Buffer.from(value, "ascii"));
  }

  private hashFile(filePath: string): Promise<FileHashes> {
    return this.memoize(this._hashes, filePath, async () => {
      // Reuse the buffer if this file was already read to be parsed for includes.
      const buffer = await (this._parsedBuffers.get(filePath) ?? this.readFile(filePath));

      // An unparsed file's buffer goes out of scope here on purpose: only the hashes are worth
      // keeping, a whole addon tree's contents are not.
      return {
        md5: this._deps.needed.md5 ? this._deps.hashes.md5(buffer) : undefined,
        murmur: this._deps.needed.murmur ? this._deps.hashes.murmur(buffer) : undefined,
      };
    });
  }

  private async readFile(filePath: string): Promise<Buffer> {
    this._fileReadCount += 1;
    return await this._io.readFile(filePath);
  }

  private memoize<T>(cache: Map<string, Promise<T>>, key: string, create: () => Promise<T>): Promise<T> {
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    // A rejection is cached along with everything else, which matches the old behaviour of letting
    // a failed read fail the folder's scan.
    const pending = create();
    cache.set(key, pending);
    return pending;
  }
}
