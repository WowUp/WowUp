import * as log from "electron-log/main";

import { IPC_ADDON_GET_SCAN_RESULTS } from "../../../src/common/constants";
import { AddonScanRequest, FolderScanResults } from "../../../src/common/models/addon-scan";
import { AddonScanService } from "../../services/scan/addon-scan.service";
import { ipcHandle, IpcController } from "../ipc-controller";

/** Fingerprints on their own, for callers outside a full scan (e.g. after an install). A scan uses AddonSyncController. */
export class AddonFingerprintController implements IpcController {
  public constructor(private readonly _scanService: AddonScanService) {}

  public register(): void {
    ipcHandle(IPC_ADDON_GET_SCAN_RESULTS, (_evt, request: AddonScanRequest) => this.scan(request));
  }

  private async scan(request: AddonScanRequest): Promise<FolderScanResults[]> {
    try {
      return await this._scanService.scanFolders(request);
    } catch (e) {
      log.error("Failed during addon scan", e);
      throw e;
    }
  }
}
