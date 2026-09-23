import { expect } from "chai";

import type { ProcessMetric } from "electron";

import { MetricsLogger, ProcessMetricsDeps, ProcessMetricsService } from "./process-metrics";
import { describeWindow, formatSnapshot, WindowSample } from "../../../src/common/models/process-metrics";

interface FakeProcess {
  pid: number;
  type?: ProcessMetric["type"];
  name?: string;
  /** Total cpu seconds burned since the process started. */
  cumulative?: number;
  percent?: number;
  workingSetKb?: number;
  creationTime?: number;
}

function metric(fake: FakeProcess): ProcessMetric {
  return {
    pid: fake.pid,
    type: fake.type ?? "Tab",
    name: fake.name,
    creationTime: fake.creationTime ?? 1000,
    cpu: {
      cumulativeCPUUsage: fake.cumulative,
      percentCPUUsage: fake.percent ?? 0,
      idleWakeupsPerSecond: 0,
    },
    memory: {
      workingSetSize: fake.workingSetKb ?? 0,
      peakWorkingSetSize: fake.workingSetKb ?? 0,
    },
  } as ProcessMetric;
}

class FakeLogger implements MetricsLogger {
  public readonly lines: string[] = [];
  public readonly errors: unknown[][] = [];

  public info(...args: unknown[]): void {
    this.lines.push(args.map((a) => String(a)).join(" "));
  }

  public error(...args: unknown[]): void {
    this.errors.push(args);
  }
}

interface Harness {
  service: ProcessMetricsService;
  log: FakeLogger;
  setMetrics: (metrics: ProcessMetric[]) => void;
  setWindow: (window: WindowSample | undefined) => void;
  advance: (ms: number) => void;
}

function harness(overrides: Partial<ProcessMetricsDeps> = {}): Harness {
  const log = new FakeLogger();
  let clock = 0;
  let metrics: ProcessMetric[] = [];
  let window: WindowSample | undefined = { visible: true, minimized: false, focused: true };

  const service = new ProcessMetricsService({
    getAppMetrics: () => metrics,
    getWindowSample: () => window,
    flavor: "ow",
    log,
    now: () => clock,
    ...overrides,
  });

  return {
    service,
    log,
    setMetrics: (next) => (metrics = next),
    setWindow: (next) => (window = next),
    advance: (ms) => (clock += ms),
  };
}

describe("ProcessMetricsService", () => {
  describe("collect", () => {
    it("reports the first sample as unmeasured and every later one as measured", () => {
      const h = harness();
      h.setMetrics([metric({ pid: 1, cumulative: 0 })]);

      expect(h.service.collect().cpuMeasured).to.equal(false);

      h.advance(60000);
      expect(h.service.collect().cpuMeasured).to.equal(true);
    });

    it("derives cpu percent from cumulative cpu seconds over the elapsed interval", () => {
      const h = harness();
      h.setMetrics([metric({ pid: 1, cumulative: 10 })]);
      h.service.collect();

      // 6 more cpu seconds burned over 60 wall clock seconds is 10% of one core.
      h.advance(60000);
      h.setMetrics([metric({ pid: 1, cumulative: 16 })]);

      expect(h.service.collect().processes[0].cpuPercent).to.equal(10);
    });

    it("falls back to chromium's own percent for a process it has not seen before", () => {
      const h = harness();
      h.setMetrics([metric({ pid: 1, cumulative: 10, percent: 42.44 })]);

      expect(h.service.collect().processes[0].cpuPercent).to.equal(42.4);
    });

    it("does not carry a cpu baseline across a reused pid", () => {
      const h = harness();
      h.setMetrics([metric({ pid: 1, cumulative: 100, creationTime: 1000 })]);
      h.service.collect();

      // Same pid, different process: its cumulative counter started over.
      h.advance(60000);
      h.setMetrics([metric({ pid: 1, cumulative: 3, percent: 1.5, creationTime: 2000 })]);

      expect(h.service.collect().processes[0].cpuPercent).to.equal(1.5);
    });

    it("converts the working set to megabytes and totals the processes", () => {
      const h = harness();
      h.setMetrics([
        metric({ pid: 1, cumulative: 0, workingSetKb: 229_478 }),
        metric({ pid: 2, cumulative: 0, workingSetKb: 93_594 }),
      ]);
      h.service.collect();

      h.advance(60000);
      h.setMetrics([
        metric({ pid: 1, cumulative: 6, workingSetKb: 229_478 }),
        metric({ pid: 2, cumulative: 1.2, workingSetKb: 93_594 }),
      ]);
      const snapshot = h.service.collect();

      expect(snapshot.processes[0].memoryMb).to.equal(224.1);
      expect(snapshot.totalMemoryMb).to.equal(315.5);
      expect(snapshot.totalCpuPercent).to.equal(12);
    });

    it("forgets processes that have gone away", () => {
      const h = harness();
      h.setMetrics([metric({ pid: 1, cumulative: 10 }), metric({ pid: 2, cumulative: 10 })]);
      h.service.collect();

      // Process 2 exits and its pid is handed to something new with the same creation time.
      h.advance(60000);
      h.setMetrics([metric({ pid: 1, cumulative: 10 })]);
      h.service.collect();

      h.advance(60000);
      h.setMetrics([metric({ pid: 1, cumulative: 10 }), metric({ pid: 2, cumulative: 500, percent: 2 })]);
      const snapshot = h.service.collect();

      expect(snapshot.processes[1].cpuPercent).to.equal(2);
    });

    it("labels each process so one renderer can be told from another", () => {
      const h = harness({ getProcessLabels: () => new Map([[7, "devtools"]]) });
      h.setMetrics([metric({ pid: 7, cumulative: 0 }), metric({ pid: 8, cumulative: 0 })]);

      const snapshot = h.service.collect();

      expect(snapshot.processes[0].label).to.equal("devtools");
      expect(snapshot.processes[1].label).to.equal(undefined);
      expect(formatSnapshot(snapshot)[1]).to.contain("Tab[devtools]");
    });

    it("carries the window state through so a busy sample can be read in context", () => {
      const h = harness();
      h.setWindow({ visible: false, minimized: false, focused: false });
      h.setMetrics([metric({ pid: 1, cumulative: 0 })]);

      expect(describeWindow(h.service.collect().window)).to.equal("hidden");
    });
  });

  describe("sample", () => {
    it("writes nothing for the priming sample", () => {
      const h = harness();
      h.setMetrics([metric({ pid: 1, cumulative: 0, percent: 90 })]);

      h.service.sample();

      expect(h.log.lines).to.be.empty;
    });

    it("writes a per process breakdown once the app is busy", () => {
      const h = harness({ busyCpuPercent: 5 });
      h.setMetrics([metric({ pid: 1, cumulative: 0 }), metric({ pid: 2, cumulative: 0, type: "Browser" })]);
      h.service.sample();

      h.advance(60000);
      h.setMetrics([metric({ pid: 1, cumulative: 6.6 }), metric({ pid: 2, cumulative: 0.6, type: "Browser" })]);
      h.service.sample();

      expect(h.log.lines).to.have.lengthOf(3);
      expect(h.log.lines[0]).to.contain("cpu=12%").and.to.contain("flavor=ow").and.to.contain("window=focused");
      expect(h.log.lines[1]).to.contain("pid=1").and.to.contain("cpu=11%");
      expect(h.log.lines[2]).to.contain("pid=2");
    });

    it("does not write a second breakdown while the app stays busy", () => {
      const h = harness({ busyCpuPercent: 5, busyLogIntervalMs: 300000, heartbeatIntervalMs: 900000 });
      h.setMetrics([metric({ pid: 1, cumulative: 0 })]);
      h.service.sample();

      let cumulative = 0;
      for (let i = 0; i < 4; i += 1) {
        h.advance(60000);
        cumulative += 6;
        h.setMetrics([metric({ pid: 1, cumulative })]);
        h.service.sample();
      }

      expect(h.log.lines).to.have.lengthOf(2);

      // Past the busy window, so the ongoing load gets recorded again.
      h.advance(120000);
      cumulative += 12;
      h.setMetrics([metric({ pid: 1, cumulative })]);
      h.service.sample();

      expect(h.log.lines).to.have.lengthOf(4);
    });

    it("writes a one line heartbeat while the app is quiet", () => {
      const h = harness({ busyCpuPercent: 5, heartbeatIntervalMs: 900000 });
      h.setMetrics([metric({ pid: 1, cumulative: 0 })]);
      h.service.sample();

      h.advance(60000);
      h.setMetrics([metric({ pid: 1, cumulative: 0.1 })]);
      h.service.sample();

      expect(h.log.lines).to.have.lengthOf(1);
      expect(h.log.lines[0]).to.contain("procs=1");

      // Still quiet, and not yet a heartbeat interval later.
      h.advance(60000);
      h.setMetrics([metric({ pid: 1, cumulative: 0.2 })]);
      h.service.sample();

      expect(h.log.lines).to.have.lengthOf(1);
    });

    it("keeps sampling when the logger throws", () => {
      const h = harness();
      h.setMetrics([metric({ pid: 1, cumulative: 0 })]);
      h.service.sample();

      const thrower = new Error("log file is gone");
      h.log.info = () => {
        throw thrower;
      };

      h.advance(60000);
      h.setMetrics([metric({ pid: 1, cumulative: 6 })]);
      const snapshot = h.service.sample();

      expect(snapshot.totalCpuPercent).to.equal(10);
      expect(h.log.errors).to.have.lengthOf(1);
    });
  });

  describe("logRendererMemory", () => {
    it("names every renderer and its memory on one line", () => {
      const h = harness({ getProcessLabels: () => new Map([[2, "devtools"]]) });
      h.setMetrics([
        metric({ pid: 1, type: "Browser", workingSetKb: 150_000 }),
        metric({ pid: 2, workingSetKb: 1_024_000 }),
        metric({ pid: 3, workingSetKb: 409_600 }),
      ]);

      h.service.logRendererMemory("renderers after scan");

      expect(h.log.lines).to.have.lengthOf(1);
      expect(h.log.lines[0]).to.equal("[metrics] renderers after scan: devtools=1000MB pid3=400MB");
    });

    it("does not disturb the cpu baseline the scheduled samples depend on", () => {
      const h = harness();
      h.setMetrics([metric({ pid: 1, cumulative: 10 })]);
      h.service.collect();

      // An out of band memory line between two samples must not become the interval cpu is
      // measured over, or the next sample would under-report.
      h.advance(30000);
      h.setMetrics([metric({ pid: 1, cumulative: 13 })]);
      h.service.logRendererMemory("mid");

      h.advance(30000);
      h.setMetrics([metric({ pid: 1, cumulative: 16 })]);

      // 6 cpu seconds over the full 60s since the last collect, not 3 over the last 30s.
      expect(h.service.collect().processes[0].cpuPercent).to.equal(10);
    });
  });

  describe("logSnapshot", () => {
    it("writes the reason and the full breakdown however quiet the app is", () => {
      const h = harness();
      h.setMetrics([metric({ pid: 1, cumulative: 0 })]);

      h.service.logSnapshot("requested by hand");

      expect(h.log.lines[0]).to.contain("requested by hand");
      expect(h.log.lines[1]).to.contain("priming, cpu not measured yet");
      expect(h.log.lines).to.have.lengthOf(3);
    });
  });

  describe("formatSnapshot", () => {
    it("puts the busiest process first", () => {
      const h = harness();
      h.setMetrics([
        metric({ pid: 1, cumulative: 0 }),
        metric({ pid: 2, cumulative: 0, type: "Utility", name: "Network Service" }),
      ]);
      h.service.collect();

      h.advance(60000);
      h.setMetrics([
        metric({ pid: 1, cumulative: 0.6 }),
        metric({ pid: 2, cumulative: 6, type: "Utility", name: "Network Service" }),
      ]);
      const lines = formatSnapshot(h.service.collect());

      expect(lines[1]).to.contain("Utility[Network Service]").and.to.contain("pid=2");
      expect(lines[2]).to.contain("pid=1");
    });
  });

  describe("describeWindow", () => {
    it("names each state a busy sample could have been taken in", () => {
      expect(describeWindow(undefined)).to.equal("unknown");
      expect(describeWindow({ visible: true, minimized: true, focused: false })).to.equal("minimized");
      expect(describeWindow({ visible: false, minimized: false, focused: false })).to.equal("hidden");
      expect(describeWindow({ visible: true, minimized: false, focused: false })).to.equal("visible");
      expect(describeWindow({ visible: true, minimized: false, focused: true })).to.equal("focused");
    });
  });
});
