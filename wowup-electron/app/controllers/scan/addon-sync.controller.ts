import * as log from "electron-log/main";

import { IPC_ADDON_SCAN, IPC_ADDON_SCAN_PREPARE, IPC_ADDON_SYNC_APPLY } from "../../../src/common/constants";
import {
  ApplyAddonSyncRequest,
  PrepareAddonScanRequest,
  ScanAddonsRequest,
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
    // Only the debug log's fingerprint dump still asks for the folders on their own
    ipcHandle(IPC_ADDON_SCAN_PREPARE, (_evt, request: PrepareAddonScanRequest) =>
      this._syncService.prepareScan(request),
    );
    ipcHandle(IPC_ADDON_SCAN, (_evt, request: ScanAddonsRequest) => this.scan(request));
    ipcHandle(IPC_ADDON_SYNC_APPLY, (_evt, request: ApplyAddonSyncRequest) => this._syncService.applySync(request));
  }

  private async scan(request: ScanAddonsRequest) {
    try {
      return await this._syncService.scan(request);
    } catch (e) {
      log.error("Failed to scan addons", e);
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
