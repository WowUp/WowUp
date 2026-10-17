import type { ProcessMetric } from "electron";

import {
  formatHeader,
  formatSnapshot,
  MetricsSnapshot,
  ProcessSample,
  WindowSample,
} from "../../../src/common/models/process-metrics";

/** How often the sampler asks chromium for a fresh set of process metrics. */
export const METRICS_SAMPLE_INTERVAL_MS = 60000;

/** A total at or above this (percent of one core) is worth a per process breakdown in the log. */
export const METRICS_BUSY_CPU_PERCENT = 5;

/** While the app stays busy, write at most one breakdown per this window so the log stays usable. */
export const METRICS_BUSY_LOG_INTERVAL_MS = 300000;

/** Write a one line baseline at least this often, however quiet things are. */
export const METRICS_HEARTBEAT_INTERVAL_MS = 900000;

export interface MetricsLogger {
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface ProcessMetricsDeps {
  getAppMetrics: () => ProcessMetric[];
  /** Returns undefined when there is no main window to describe. */
  getWindowSample: () => WindowSample | undefined;
  /** pid -> what is running in it, so a busy renderer can be told apart from the other renderers. */
  getProcessLabels?: () => Map<number, string>;
  flavor: string;
  log: MetricsLogger;
  now?: () => number;
  sampleIntervalMs?: number;
  busyCpuPercent?: number;
  busyLogIntervalMs?: number;
  heartbeatIntervalMs?: number;
}

interface ProcessCpuState {
  cumulativeCpuSeconds: number;
  takenAt: number;
}

function round(value: number, places: number): number {
  const factor = Math.pow(10, places);
  return Math.round(value * factor) / factor;
}

/**
 * Pids get reused, so a process is only the same process as long as its creation time matches too.
 */
function processKey(metric: ProcessMetric): string {
  return `${metric.pid}:${metric.creationTime}`;
}

/** Something that has never been written is always due, whatever the clock's origin happens to be. */
function isDue(lastAt: number | undefined, intervalMs: number, now: number): boolean {
  return lastAt === undefined || now - lastAt >= intervalMs;
}

/**
 * Samples chromium's per process cpu and memory and writes the interesting ones to the log.
 *
 * The point is to make a "wowup is eating my cpu" report answerable from the user's log file: which
 * process was busy, and whether the window was even on screen at the time. Chromium's own
 * percentCPUUsage is a delta against whenever it last happened to be asked, so the cpu figure here
 * is computed from cumulative cpu seconds over the sampler's own interval instead.
 */
export class ProcessMetricsService {
  private readonly _previous = new Map<string, ProcessCpuState>();
  private readonly _now: () => number;
  private readonly _sampleIntervalMs: number;
  private readonly _busyCpuPercent: number;
  private readonly _busyLogIntervalMs: number;
  private readonly _heartbeatIntervalMs: number;

  private _timer: NodeJS.Timeout | undefined;
  private _cpuMeasured = false;
  /** Undefined until the first one is written, which is not the same as "written at time zero". */
  private _lastBreakdownAt: number | undefined;
  private _lastHeartbeatAt: number | undefined;

  public constructor(private readonly _deps: ProcessMetricsDeps) {
    this._now = _deps.now ?? ((): number => Date.now());
    this._sampleIntervalMs = _deps.sampleIntervalMs ?? METRICS_SAMPLE_INTERVAL_MS;
    this._busyCpuPercent = _deps.busyCpuPercent ?? METRICS_BUSY_CPU_PERCENT;
    this._busyLogIntervalMs = _deps.busyLogIntervalMs ?? METRICS_BUSY_LOG_INTERVAL_MS;
    this._heartbeatIntervalMs = _deps.heartbeatIntervalMs ?? METRICS_HEARTBEAT_INTERVAL_MS;
  }

  public start(): void {
    if (this._timer !== undefined) {
      return;
    }

    // The first collect only primes the cpu baseline, it cannot report a rate yet.
    this.collect();

    this._timer = setInterval(() => this.sample(), this._sampleIntervalMs);
    this._timer.unref?.();
  }

  public stop(): void {
    if (this._timer === undefined) {
      return;
    }

    clearInterval(this._timer);
    this._timer = undefined;
  }

  /** Take a snapshot without writing anything. */
  public collect(): MetricsSnapshot {
    const takenAt = this._now();
    const metrics = this._deps.getAppMetrics();
    const labels = this._deps.getProcessLabels?.() ?? new Map<number, string>();
    const seen = new Set<string>();

    const processes: ProcessSample[] = metrics.map((metric) => {
      const key = processKey(metric);
      seen.add(key);

      return {
        pid: metric.pid,
        type: metric.type,
        name: metric.name ?? metric.serviceName,
        label: labels.get(metric.pid),
        cpuPercent: this.resolveCpuPercent(metric, key, takenAt),
        memoryMb: round((metric.memory?.workingSetSize ?? 0) / 1024, 1),
      };
    });

    for (const key of [...this._previous.keys()]) {
      if (!seen.has(key)) {
        this._previous.delete(key);
      }
    }

    const snapshot: MetricsSnapshot = {
      takenAt,
      flavor: this._deps.flavor,
      window: this._deps.getWindowSample(),
      processes,
      totalCpuPercent: round(
        processes.reduce((total, sample) => total + sample.cpuPercent, 0),
        1,
      ),
      totalMemoryMb: round(
        processes.reduce((total, sample) => total + sample.memoryMb, 0),
        1,
      ),
      cpuMeasured: this._cpuMeasured,
    };

    this._cpuMeasured = true;
    return snapshot;
  }

  /** Take a snapshot and write it if this one is worth writing. */
  public sample(): MetricsSnapshot {
    const snapshot = this.collect();

    try {
      this.applyLogPolicy(snapshot);
    } catch (e) {
      this._deps.log.error("[metrics] failed to log a sample", e);
    }

    return snapshot;
  }

  /**
   * One compact line naming every renderer and its memory.
   *
   * For watching whether something grows across repeated work. Deliberately does not go through
   * collect(): that would move the cpu baseline and make the next scheduled sample under-report.
   */
  public logRendererMemory(reason: string): void {
    const labels = this._deps.getProcessLabels?.() ?? new Map<number, string>();

    const renderers = this._deps
      .getAppMetrics()
      .filter((metric) => metric.type === "Tab")
      .map((metric) => {
        const name = labels.get(metric.pid) ?? `pid${metric.pid}`;
        return `${name}=${round((metric.memory?.workingSetSize ?? 0) / 1024, 1)}MB`;
      });

    this._deps.log.info(`[metrics] ${reason}: ${renderers.join(" ")}`);
  }

  /** Take a snapshot and always write the full breakdown, whatever the policy would have said. */
  public logSnapshot(reason: string): MetricsSnapshot {
    const snapshot = this.collect();

    this._deps.log.info(`[metrics] ${reason}`);
    this.writeBreakdown(snapshot);

    return snapshot;
  }

  private applyLogPolicy(snapshot: MetricsSnapshot): void {
    // A priming sample's cpu numbers are meaningless, so there is nothing here worth keeping.
    if (!snapshot.cpuMeasured) {
      return;
    }

    const busy = snapshot.totalCpuPercent >= this._busyCpuPercent;
    if (busy && isDue(this._lastBreakdownAt, this._busyLogIntervalMs, snapshot.takenAt)) {
      this.writeBreakdown(snapshot);
      this._lastBreakdownAt = snapshot.takenAt;
      this._lastHeartbeatAt = snapshot.takenAt;
      return;
    }

    if (isDue(this._lastHeartbeatAt, this._heartbeatIntervalMs, snapshot.takenAt)) {
      this._deps.log.info(`[metrics] ${formatHeader(snapshot)}`);
      this._lastHeartbeatAt = snapshot.takenAt;
    }
  }

  private writeBreakdown(snapshot: MetricsSnapshot): void {
    for (const line of formatSnapshot(snapshot)) {
      this._deps.log.info(`[metrics] ${line}`);
    }
  }

  private resolveCpuPercent(metric: ProcessMetric, key: string, takenAt: number): number {
    const cumulative = metric.cpu?.cumulativeCPUUsage;
    const previous = this._previous.get(key);

    if (typeof cumulative === "number") {
      this._previous.set(key, { cumulativeCpuSeconds: cumulative, takenAt });

      if (previous !== undefined && takenAt > previous.takenAt) {
        const elapsedSeconds = (takenAt - previous.takenAt) / 1000;
        const usedSeconds = Math.max(0, cumulative - previous.cumulativeCpuSeconds);
        return round((usedSeconds / elapsedSeconds) * 100, 1);
      }
    }

    // A process we have not seen before, or a build that does not report cumulative cpu time.
    return round(metric.cpu?.percentCPUUsage ?? 0, 1);
  }
}
