import { expect } from "chai";

import { SHELL_API_VERSION, WowUpShell, getShell, setShell } from "./shell-api";

describe("shell-api", () => {
  const shellGlobal = globalThis as unknown as Record<string, unknown>;

  afterEach(() => {
    delete shellGlobal.__wowupShell;
  });

  it("throws when the shell has not been set", () => {
    expect(() => getShell()).to.throw(/shell not initialized/);
  });

  it("returns the shell that was set", () => {
    const shell: WowUpShell = {
      apiVersion: SHELL_API_VERSION,
      logPath: "/logs",
      paths: { shellRoot: "/shell", bundleRoot: "/bundle", nativeAddon: "/shell/addon.node" },
      bundle: { version: "2.25.0", channel: "beta", source: "builtin" },
      markHealthy: () => undefined,
    };
    setShell(shell);

    expect(getShell()).to.equal(shell);
  });

  it("hands the shell over on globalThis so a separately built bundle can read it", () => {
    const shell: WowUpShell = {
      apiVersion: SHELL_API_VERSION,
      logPath: "/logs",
      paths: { shellRoot: "/shell", bundleRoot: "/bundle", nativeAddon: "/shell/addon.node" },
      bundle: { version: "2.25.0", channel: "beta", source: "builtin" },
      markHealthy: () => undefined,
    };
    setShell(shell);

    expect(shellGlobal.__wowupShell).to.equal(shell);
  });
});
