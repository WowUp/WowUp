import * as log from "electron-log/main";

import { IPC_ADDON_SCAN_COMPLETE, IPC_ADDON_SCAN_PREPARE, IPC_ADDON_SYNC_APPLY } from "../../../src/common/constants";
import {
  ApplyAddonSyncRequest,
  CompleteAddonScanRequest,
  PrepareAddonScanRequest,
} from "../../../src/common/models/addon-scan";
import { AddonSyncService } from "../../services/addons/addon-sync.service";
import { ipcHandle, IpcController } from "../ipc-controller";

export class AddonSyncController implements IpcController {
  /**
   * @param onScanComplete run after every completed scan, whatever the outcome. Used to trace renderer
   * memory across repeated scans, which is the only way to tell a leak from v8 simply not handing back
   * the heap it grew for one scan's worth of objects.
   */
  public constructor(
    private readonly _syncService: AddonSyncService,
    private readonly _onScanComplete?: () => void,
  ) {}

  public register(): void {
    ipcHandle(IPC_ADDON_SCAN_PREPARE, (_evt, request: PrepareAddonScanRequest) =>
      this._syncService.prepareScan(request),
    );
    ipcHandle(IPC_ADDON_SCAN_COMPLETE, (_evt, request: CompleteAddonScanRequest) => this.completeScan(request));
    ipcHandle(IPC_ADDON_SYNC_APPLY, (_evt, request: ApplyAddonSyncRequest) => this._syncService.applySync(request));
  }

  private async completeScan(request: CompleteAddonScanRequest) {
    try {
      return await this._syncService.completeScan(request);
    } catch (e) {
      log.error("Failed to complete addon scan", e);
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
