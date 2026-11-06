/**
 * A single chromium process as one metrics sample saw it.
 */
export interface ProcessSample {
  pid: number;
  /** Chromium's process type, e.g. Browser, Tab, GPU, Utility. */
  type: string;
  /** Set for utility processes, e.g. "Network Service". */
  name?: string;
  /** What is actually running in this process, e.g. "window:index.html", "devtools". */
  label?: string;
  /** Percent of one core over the interval between this sample and the previous one. */
  cpuPercent: number;
  /** Working set in megabytes. */
  memoryMb: number;
}

/**
 * Where the main window was when the sample was taken. This is the half of the picture that says
 * whether a busy process had any reason to be busy.
 */
export interface WindowSample {
  visible: boolean;
  minimized: boolean;
  focused: boolean;
}

export interface MetricsSnapshot {
  takenAt: number;
  /** "wago" or "ow", so a pasted snapshot identifies which build produced it. */
  flavor: string;
  /** Undefined before the main window exists, or once it is gone. */
  window?: WindowSample;
  processes: ProcessSample[];
  totalCpuPercent: number;
  totalMemoryMb: number;
  /**
   * False for the very first sample of a process, which has no previous sample to be measured
   * against and so reports a cpu figure that means nothing.
   */
  cpuMeasured: boolean;
}

export function describeWindow(window: WindowSample | undefined): string {
  if (window === undefined) {
    return "unknown";
  }
  if (window.minimized) {
    return "minimized";
  }
  if (!window.visible) {
    return "hidden";
  }
  return window.focused ? "focused" : "visible";
}

export function describeProcess(sample: ProcessSample): string {
  const detail = sample.label ?? sample.name;
  const suffix = detail !== undefined && detail.length > 0 ? `[${detail}]` : "";
  return `${sample.type}${suffix} pid=${sample.pid} cpu=${sample.cpuPercent}% mem=${sample.memoryMb}MB`;
}

export function formatHeader(snapshot: MetricsSnapshot): string {
  const parts = [
    `flavor=${snapshot.flavor}`,
    `window=${describeWindow(snapshot.window)}`,
    `cpu=${snapshot.totalCpuPercent}%`,
    `mem=${snapshot.totalMemoryMb}MB`,
    `procs=${snapshot.processes.length}`,
  ];

  if (!snapshot.cpuMeasured) {
    parts.push("(priming, cpu not measured yet)");
  }

  return parts.join(" ");
}

/** Header plus one line per process, busiest first. */
export function formatSnapshot(snapshot: MetricsSnapshot): string[] {
  const byCpu = [...snapshot.processes].sort((a, b) => b.cpuPercent - a.cpuPercent);
  return [formatHeader(snapshot), ...byCpu.map((sample) => `  ${describeProcess(sample)}`)];
}
