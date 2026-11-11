import { Injectable } from "@angular/core";
import { Addon } from "wowup-lib-core";

import { IPC_ADDON_SCAN_COMPLETE, IPC_ADDON_SCAN_PREPARE, IPC_ADDON_SYNC_APPLY } from "../../../common/constants";
import {
  AppliedAddonSync,
  ApplyAddonSyncRequest,
  CompleteAddonScanRequest,
  PrepareAddonScanRequest,
  PreparedAddonScan,
} from "../../../common/models/addon-scan";

import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class AddonSyncApiService {
  public constructor(private readonly _electronService: ElectronService) {}

  /** List, flag and fingerprint an installation's addon folders, ready for the providers to match */
  public prepareScan(request: PrepareAddonScanRequest): Promise<PreparedAddonScan> {
    return this._electronService.invoke(IPC_ADDON_SCAN_PREPARE, request);
  }

  /** Turn the matched folders into the installation's addons, saving them when `request.save` is set */
  public completeScan(request: CompleteAddonScanRequest): Promise<Addon[]> {
    return this._electronService.invoke(IPC_ADDON_SCAN_COMPLETE, request);
  }

  /** Apply one provider's sync answer to the addons and save them */
  public applySync(request: ApplyAddonSyncRequest): Promise<AppliedAddonSync> {
    return this._electronService.invoke(IPC_ADDON_SYNC_APPLY, request);
  }
}
