import { Injectable } from "@angular/core";
import { IPC_CURSE_GET_SCAN_RESULTS, IPC_WOWUP_GET_SCAN_RESULTS } from "../../../common/constants";
import { CurseFolderScanResult } from "../../../common/curse/curse-folder-scan-result";
import { AddonFolder } from "../../models/wowup/addon-folder";
import { AppWowUpScanResult } from "../../models/wowup/app-wowup-scan-result";
import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class AddonFingerprintService {
  public constructor(private _electronService: ElectronService) {}

  public async getFingerprints(addonFolders: AddonFolder[]) {
    const filePaths = addonFolders.map((addonFolder) => addonFolder.path);

    console.time("WowUpScan");
    const wowUpScanResults: AppWowUpScanResult[] = await this._electronService.invoke(
      IPC_WOWUP_GET_SCAN_RESULTS,
      filePaths
    );
    console.timeEnd("WowUpScan");

    console.time("CFScan");
    const cfScanResults: CurseFolderScanResult[] = await this._electronService.invoke(
      IPC_CURSE_GET_SCAN_RESULTS,
      filePaths
    );
    console.timeEnd("CFScan");

    addonFolders.forEach((af) => {
      af.wowUpScanResults = wowUpScanResults.find((wur) => wur.path === af.path);
      af.cfScanResults = cfScanResults.find((cfr) => cfr.directory === af.path);
    });
  }
}
