import NodeCache = require("node-cache");
import { AddonChannelType, WowClientType, WowInstallation } from "wowup-lib-core";

import { HttpCircuitBreaker } from "../network/circuit-breaker";
import { HttpClient } from "../network/http-client";
import { NetworkInterface } from "../network/network-interface";
import { ProviderNetworkInterface } from "../network/provider-network-interface";

/**
 * Helpers for the `*.live-test.ts` suites, which call the real hub, TukUI and WowInterface APIs
 * through main's own network stack. They are not in `npm run test:main`; run `npm run test:main:live`.
 */
const quietLog = { info: () => undefined, error: () => undefined };

export function createLiveNetwork(name: string): NetworkInterface {
  const http = new HttpClient({ fetch: (url, init) => fetch(url, init), log: quietLog });
  const breaker = new HttpCircuitBreaker(http, {
    name,
    resetTimeoutMs: 1000,
    httpTimeoutMs: 15000,
    log: quietLog,
  });
  return new ProviderNetworkInterface(breaker, new NodeCache());
}

export function createLiveInstallation(): WowInstallation {
  return {
    clientType: WowClientType.Retail,
    defaultAddonChannelType: AddonChannelType.Stable,
    defaultAutoUpdate: false,
    displayName: "test-client",
    id: "test-install",
    label: "test-client",
    location: "nowhere",
    selected: true,
    availableUpdateCount: 0,
  };
}

export async function expectRejection(promise: Promise<unknown>, message: string): Promise<void> {
  try {
    await promise;
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes(message)) {
      throw new Error(`expected a rejection containing "${message}", got ${String(e)}`);
    }
    return;
  }
  throw new Error(`expected a rejection containing "${message}"`);
}

/** Keeps the providers' expected warnings and errors out of the test output */
export function silenceConsoleErrors(): void {
  const levels = ["log", "info", "warn", "error"] as const;
  const originals = levels.map((level) => console[level]);
  beforeEach(() => levels.forEach((level) => (console[level] = () => undefined)));
  afterEach(() => levels.forEach((level, i) => (console[level] = originals[i])));
}
