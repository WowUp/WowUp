import { firstValueFrom, from, mergeMap, toArray } from "rxjs";

import { AddonScanRequest, AddonScanSource, FolderScanResults } from "../../../src/common/models/addon-scan";
import { CurseFolderScanner } from "../../curse-folder-scanner";
import { WowUpFolderScanner } from "../../wowup-folder-scanner";
import { FileHashAlgorithms, FolderScanContext, FolderScanIo, ScanLogger } from "./folder-scan-context";

/** How many addon folders are scanned at once. Was the wowup scan's own limit. */
const FOLDER_CONCURRENCY = 3;

export interface AddonScanDeps {
  hashes: FileHashAlgorithms;
  log: ScanLogger;
  io?: Partial<FolderScanIo>;
}

export interface ScanSummary {
  folderCount: number;
  /** Files actually read from disk, across every folder. */
  fileReadCount: number;
  durationMs: number;
}

/**
 * Runs the fingerprint scanners over a set of addon folders.
 *
 * Both scanners used to be driven by their own ipc call, which meant every addon folder was walked
 * twice and every matched file was read twice over. They now run together against one shared
 * context per folder, so the tree is walked once and each file is read once however many
 * fingerprints are wanted from it.
 */
export class AddonScanService {
  public constructor(private readonly _deps: AddonScanDeps) {}

  public async scanFolders(request: AddonScanRequest): Promise<FolderScanResults[]> {
    const { filePaths, sources } = request;

    if (sources.length === 0) {
      return filePaths.map((path) => ({ path }));
    }

    const startedAt = Date.now();
    let fileReadCount = 0;

    const results = await firstValueFrom(
      from(filePaths).pipe(
        mergeMap(
          (folderPath) =>
            from(
              this.scanFolder(folderPath, sources).then((result) => {
                fileReadCount += result.fileReadCount;
                return result.results;
              }),
            ),
          FOLDER_CONCURRENCY,
        ),
        toArray(),
      ),
    );

    this._deps.log.debug(
      `[scan] ${sources.join("+")} scan of ${filePaths.length} folders read ${fileReadCount} files in ${
        Date.now() - startedAt
      }ms`,
    );

    return results;
  }

  private async scanFolder(
    folderPath: string,
    sources: AddonScanSource[],
  ): Promise<{ results: FolderScanResults; fileReadCount: number }> {
    const context = new FolderScanContext({
      hashes: this._deps.hashes,
      needed: {
        md5: sources.includes("wowup"),
        murmur: sources.includes("curseforge"),
      },
      log: this._deps.log,
      io: this._deps.io,
    });

    const results: FolderScanResults = { path: folderPath };

    // Deliberately sequential. The second scanner matches nearly the same files as the first, so it
    // reads almost nothing: running them concurrently would only double the reads in flight.
    if (sources.includes("wowup")) {
      results.wowup = await new WowUpFolderScanner(folderPath, context).scanFolder();
    }

    if (sources.includes("curseforge")) {
      results.curseforge = await new CurseFolderScanner(context).scanFolder(folderPath);
    }

    return { results, fileReadCount: context.fileReadCount };
  }
}
