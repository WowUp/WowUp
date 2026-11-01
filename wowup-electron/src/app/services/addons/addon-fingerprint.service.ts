import { Injectable } from "@angular/core";
import { AddonFolder } from "wowup-lib-core";
import { AddonScanSource } from "../../../common/models/addon-scan";
import { AddonScanApiService } from "../api/addon-scan-api.service";
import { AppConfig } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class AddonFingerprintService {
  public constructor(private _addonScanApiService: AddonScanApiService) {}

  public async getFingerprints(addonFolders: AddonFolder[]): Promise<void> {
    const filePaths = addonFolders.map((addonFolder) => addonFolder.path);

    const sources: AddonScanSource[] = ["wowup"];
    if (AppConfig.curseforge.enabled) {
      sources.push("curseforge");
    }

    console.time("AddonScan");
    const scanResults = await this._addonScanApiService.getScanResults(filePaths, sources);
    console.timeEnd("AddonScan");

    const resultsByPath = new Map(scanResults.map((result) => [result.path, result]));

    addonFolders.forEach((af) => {
      const result = resultsByPath.get(af.path);

      af.wowUpScanResults = result?.wowup;

      if (AppConfig.curseforge.enabled) {
        af.cfScanResults = result?.curseforge;
      }
    });
  }
}
