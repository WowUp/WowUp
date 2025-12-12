import { Injectable } from "@angular/core";
import { AddonFolder } from "wowup-lib-core";
import { IpcRouterClientService } from "../ipc-router/ipc-router-client.service";

@Injectable({
  providedIn: "root",
})
export class AddonFingerprintService {
  public constructor(private _ipcClient: IpcRouterClientService) {}

  /**
   * Scans addon folders and enriches them with fingerprint data.
   * This method delegates to the main process for actual scanning and
   * mutates the input array in-place for backwards compatibility.
   *
   * @param addonFolders - Array of addon folders to scan
   */
  public async getFingerprints(addonFolders: AddonFolder[]): Promise<void> {
    // Call main process via IPC Router
    const enrichedFolders = await this._ipcClient.post<AddonFolder[]>(
      "/api/fingerprint/scan",
      { addonFolders }
    );

    // Mutate input array in-place (matches original behavior)
    addonFolders.forEach((af, index) => {
      Object.assign(af, enrichedFolders[index]);
    });
  }
}
