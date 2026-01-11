import { Injectable } from "@angular/core";
import { AddonFolder, AddonScanResult } from "wowup-lib-core";
import { IPC_CURSE_GET_SCAN_RESULTS, IPC_WOWUP_GET_SCAN_RESULTS } from "../../../common/constants";
import { ElectronService } from "../electron/electron.service";
import { AppConfig } from "../../../environments/environment";

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
      filePaths,
    );
    console.timeEnd("WowUpScan");

    let cfScanResults: AddonScanResult[] = [];
    if (AppConfig.curseforge.enabled) {
      console.time("CFScan");
      cfScanResults = await this._electronService.invoke(IPC_CURSE_GET_SCAN_RESULTS, filePaths);
      console.timeEnd("CFScan");
    }

    addonFolders.forEach((af) => {
      af.wowUpScanResults = wowUpScanResults.find((wur) => wur.path === af.path);

      if (AppConfig.curseforge.enabled) {
        af.cfScanResults = cfScanResults.find((cfr) => cfr.path === af.path);
      }
    });
  }
}
