import { Injectable } from "@angular/core";
import { AddonFolder, AddonScanResult } from "wowup-lib-core";
import { IPC_WOWUP_GET_SCAN_RESULTS } from "../../../common/constants";
import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class AddonFingerprintService {
  public constructor(private _electronService: ElectronService) {}

  public async getFingerprints(addonFolders: AddonFolder[]) {
    const filePaths = addonFolders.map((addonFolder) => addonFolder.path);

    console.time("WowUpScan");
    const wowUpScanResults: AddonScanResult[] = await this._electronService.invoke(
      IPC_WOWUP_GET_SCAN_RESULTS,
      filePaths
    );
    console.timeEnd("WowUpScan");

    addonFolders.forEach((af) => {
      af.wowUpScanResults = wowUpScanResults.find((wur) => wur.path === af.path);
    });
  }
}
