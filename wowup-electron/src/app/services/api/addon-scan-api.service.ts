import { Injectable } from "@angular/core";

import { IPC_ADDON_GET_SCAN_RESULTS } from "../../../common/constants";
import { AddonScanSource, FolderScanResults } from "../../../common/models/addon-scan";

import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class AddonScanApiService {
  public constructor(private readonly _electronService: ElectronService) {}

  /**
   * Fingerprints every folder in one round trip. Asking for both sources at once is what lets main
   * walk each folder and read each file a single time.
   */
  public getScanResults(filePaths: string[], sources: AddonScanSource[]): Promise<FolderScanResults[]> {
    return this._electronService.invoke(IPC_ADDON_GET_SCAN_RESULTS, { filePaths, sources });
  }
}
