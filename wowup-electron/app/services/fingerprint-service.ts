import { AddonFolder, AddonScanResult } from "wowup-lib-core";
import { from, firstValueFrom } from "rxjs";
import { mergeMap, toArray } from "rxjs/operators";
import { CurseFolderScanner } from "../curse-folder-scanner";
import { WowUpFolderScanner } from "../wowup-folder-scanner";
import { AppConfig } from "../../src/environments/environment";
import log from "electron-log";

/**
 * Service for scanning addon folders and generating fingerprints
 * to identify installed addons and match them with addon providers.
 */
export class FingerprintService {
  /**
   * Scans addon folders and enriches them with fingerprint data
   * from both WowUp and CurseForge scanners.
   *
   * @param addonFolders - Array of addon folders to scan
   * @returns Array of addon folders enriched with scan results
   */
  public async getFingerprints(addonFolders: AddonFolder[]): Promise<AddonFolder[]> {
    const filePaths = addonFolders.map((af) => af.path);

    // Scan with WowUp fingerprint system
    console.time("WowUpScan");
    const wowUpScanResults = await this.scanWithWowUp(filePaths);
    console.timeEnd("WowUpScan");

    // Scan with CurseForge fingerprint system (if enabled)
    let cfScanResults: AddonScanResult[] = [];
    if (AppConfig.curseforge.enabled) {
      console.time("CFScan");
      cfScanResults = await this.scanWithCurse(filePaths);
      console.timeEnd("CFScan");
    }

    // Merge scan results back into addon folders
    addonFolders.forEach((af) => {
      af.wowUpScanResults = wowUpScanResults.find((wur) => wur.path === af.path);
      if (AppConfig.curseforge.enabled) {
        af.cfScanResults = cfScanResults.find((cfr) => cfr.path === af.path);
      }
    });

    return addonFolders;
  }

  /**
   * Scans folders using WowUp fingerprint system
   * Processes up to 3 folders in parallel for performance
   */
  private async scanWithWowUp(filePaths: string[]): Promise<AddonScanResult[]> {
    const taskResults = await firstValueFrom(
      from(filePaths).pipe(
        mergeMap((folder) => from(new WowUpFolderScanner(folder).scanFolder()), 3),
        toArray()
      )
    );
    return taskResults;
  }

  /**
   * Scans folders using CurseForge fingerprint system
   * Processes up to 2 folders in parallel for performance
   */
  private async scanWithCurse(filePaths: string[]): Promise<AddonScanResult[]> {
    try {
      const taskResults = await firstValueFrom(
        from(filePaths).pipe(
          mergeMap((folder) => from(new CurseFolderScanner().scanFolder(folder)), 2),
          toArray()
        )
      );
      return taskResults;
    } catch (e) {
      log.error("Failed during curse scan", e);
      throw e;
    }
  }
}
