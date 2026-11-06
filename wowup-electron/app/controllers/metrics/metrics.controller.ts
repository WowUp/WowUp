import { IPC_METRICS_GET_SNAPSHOT, IPC_METRICS_LOG_SNAPSHOT } from "../../../src/common/constants";
import { ProcessMetricsService } from "../../services/metrics/process-metrics";
import { ipcHandle, IpcController } from "../ipc-controller";

export class MetricsController implements IpcController {
  public constructor(private readonly _metrics: ProcessMetricsService) {}

  public register(): void {
    this._metrics.start();

    ipcHandle(IPC_METRICS_GET_SNAPSHOT, () => this._metrics.collect());
    ipcHandle(IPC_METRICS_LOG_SNAPSHOT, () => this._metrics.logSnapshot("snapshot requested from the debug options"));
  }

  public dispose(): void {
    this._metrics.stop();
  }
}
