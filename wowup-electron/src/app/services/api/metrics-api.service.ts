import { Injectable } from "@angular/core";

import { IPC_METRICS_GET_SNAPSHOT, IPC_METRICS_LOG_SNAPSHOT } from "../../../common/constants";
import { MetricsSnapshot } from "../../../common/models/process-metrics";

import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class MetricsApiService {
  public constructor(private readonly _electronService: ElectronService) {}

  /** Read the current per process cpu and memory without touching the log. */
  public getSnapshot(): Promise<MetricsSnapshot> {
    return this._electronService.invoke(IPC_METRICS_GET_SNAPSHOT);
  }

  /** Write the current snapshot to the log file and hand the same snapshot back for display. */
  public logSnapshot(): Promise<MetricsSnapshot> {
    return this._electronService.invoke(IPC_METRICS_LOG_SNAPSHOT);
  }
}
