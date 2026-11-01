import { ChangeDetectorRef, Component } from "@angular/core";
import { AddonService } from "../../../services/addons/addon.service";
import { MetricsApiService } from "../../../services/api/metrics-api.service";
import { SessionService } from "../../../services/session/session.service";
import { WowUpService } from "../../../services/wowup/wowup.service";
import { describeWindow, MetricsSnapshot, ProcessSample } from "../../../../common/models/process-metrics";

@Component({
  selector: "app-options-debug-section",
  templateUrl: "./options-debug-section.component.html",
  styleUrls: ["./options-debug-section.component.scss"],
})
export class OptionsDebugSectionComponent {
  public dumpingDebugData = false;
  public loggingMetrics = false;
  public metrics: MetricsSnapshot | undefined;

  public constructor(
    private _cdRef: ChangeDetectorRef,
    private _addonService: AddonService,
    private _wowupService: WowUpService,
    private _sessionService: SessionService,
    private _metricsApiService: MetricsApiService,
  ) {}

  public get metricsProcesses(): ProcessSample[] {
    return [...(this.metrics?.processes ?? [])].sort((a, b) => b.cpuPercent - a.cpuPercent);
  }

  public get metricsWindowState(): string {
    return describeWindow(this.metrics?.window);
  }

  public describeProcessName(sample: ProcessSample): string {
    const detail = sample.label ?? sample.name;
    return detail !== undefined && detail.length > 0 ? `${sample.type} (${detail})` : sample.type;
  }

  public async onShowLogs(): Promise<void> {
    await this._wowupService.showLogsFolder();
  }

  public async onShowConfig(): Promise<void> {
    await this._wowupService.showConfigFolder();
  }

  public async onLogDebugData(): Promise<void> {
    try {
      this.dumpingDebugData = true;
      await this._addonService.logDebugData();
    } catch (e) {
      console.error(e);
    } finally {
      this.dumpingDebugData = false;
      this._cdRef.detectChanges();
    }
  }

  public onDebugAdFrame(): void {
    this._sessionService.debugAdFrame$.next(true);
  }

  public async onLogProcessMetrics(): Promise<void> {
    try {
      this.loggingMetrics = true;
      this.metrics = await this._metricsApiService.logSnapshot();
    } catch (e) {
      console.error(e);
    } finally {
      this.loggingMetrics = false;
      this._cdRef.detectChanges();
    }
  }
}
