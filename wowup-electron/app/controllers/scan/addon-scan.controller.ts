import * as log from "electron-log/main";

import { IPC_ADDON_GET_SCAN_RESULTS } from "../../../src/common/constants";
import { AddonScanRequest, FolderScanResults } from "../../../src/common/models/addon-scan";
import { AddonScanService } from "../../services/scan/addon-scan.service";
import { ipcHandle, IpcController } from "../ipc-controller";

export class AddonScanController implements IpcController {
  /**
   * @param onScanComplete run after every scan, whatever the outcome. Used to trace renderer memory
   * across repeated scans, which is the only way to tell a leak from v8 simply not handing back the
   * heap it grew for one scan's worth of objects.
   */
  public constructor(
    private readonly _scanService: AddonScanService,
    private readonly _onScanComplete?: () => void,
  ) {}

  public register(): void {
    ipcHandle(IPC_ADDON_GET_SCAN_RESULTS, (_evt, request: AddonScanRequest) => this.scan(request));
  }

  private async scan(request: AddonScanRequest): Promise<FolderScanResults[]> {
    try {
      return await this._scanService.scanFolders(request);
    } catch (e) {
      log.error("Failed during addon scan", e);
      throw e;
    } finally {
      try {
        this._onScanComplete?.();
      } catch (e) {
        log.error("Failed to trace memory after a scan", e);
      }
    }
  }
}
