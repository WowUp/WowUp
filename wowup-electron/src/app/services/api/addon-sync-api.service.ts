import { Injectable } from "@angular/core";
import { IpcRendererEvent } from "electron";
import { Addon } from "wowup-lib-core";

import {
  IPC_ADDON_SCAN,
  IPC_ADDON_SCAN_EVENT,
  IPC_ADDON_SCAN_PREPARE,
  IPC_ADDON_SYNC_APPLY,
} from "../../../common/constants";
import {
  AddonScanEvent,
  AppliedAddonSync,
  ApplyAddonSyncRequest,
  PrepareAddonScanRequest,
  PreparedAddonScan,
  ScanAddonsRequest,
} from "../../../common/models/addon-scan";

import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class AddonSyncApiService {
  public constructor(private readonly _electronService: ElectronService) {}

  /** List and fingerprint an installation's addon folders, without matching them to a provider */
  public prepareScan(request: PrepareAddonScanRequest): Promise<PreparedAddonScan> {
    return this._electronService.invoke(IPC_ADDON_SCAN_PREPARE, request);
  }

  /** Read the installation's addons off disk and match them, saving them when `request.save` is set */
  public scan(request: ScanAddonsRequest): Promise<Addon[]> {
    return this._electronService.invoke(IPC_ADDON_SCAN, request);
  }

  /** Each scan's progress and provider failures, for every installation; returns the unsubscribe */
  public onScanEvent(listener: (event: AddonScanEvent) => void): () => void {
    const handler = (_evt: IpcRendererEvent, event: AddonScanEvent) => listener(event);
    this._electronService.on(IPC_ADDON_SCAN_EVENT, handler);
    return () => this._electronService.off(IPC_ADDON_SCAN_EVENT, handler);
  }

  /** Apply one provider's sync answer to the addons and save them */
  public applySync(request: ApplyAddonSyncRequest): Promise<AppliedAddonSync> {
    return this._electronService.invoke(IPC_ADDON_SYNC_APPLY, request);
  }
}
