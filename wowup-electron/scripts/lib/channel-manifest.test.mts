// Run with `npm run test:scripts`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BundleManifest, UnsignedBundleManifest } from "../../../wowup-shell/contract/bundle-manifest.ts";
import { buildChannelManifest, type ChannelOptions } from "./channel-manifest.mts";

const URL = "https://github.com/WowUp/wowup-bundles/releases/download/wago-2.25.0/wago-2.25.0-abc.zip";

function base(version: string): UnsignedBundleManifest {
  return {
    flavor: "wago",
    channel: "beta",
    shellApi: 1,
    version,
    sha256: `sha-${version}`,
    contentSha256: `content-${version}`,
    urls: [],
    rolloutPercent: 100,
    revoked: [],
    issuedAt: "2026-10-01T00:00:00.000Z",
  };
}

function current(version: string, overrides: Partial<BundleManifest> = {}): BundleManifest {
  return { ...base(version), urls: [URL], keyId: "k", signature: "s", ...overrides };
}

function options(overrides: Partial<ChannelOptions> = {}): ChannelOptions {
  return {
    channel: "stable",
    rolloutPercent: 100,
    revoke: [],
    urls: [URL],
    now: new Date("2026-10-21T00:00:00Z"),
    ...overrides,
  };
}

describe("buildChannelManifest", () => {
  it("publishes the base bundle with the channel's settings", () => {
    const manifest = buildChannelManifest(base("2.25.0"), undefined, options({ rolloutPercent: 25 }));

    assert.equal(manifest.version, "2.25.0");
    assert.equal(manifest.channel, "stable");
    assert.equal(manifest.rolloutPercent, 25);
    assert.deepEqual(manifest.urls, [URL]);
    assert.equal(manifest.sha256, "sha-2.25.0");
    assert.equal(manifest.issuedAt, "2026-10-21T00:00:00.000Z");
  });

  it("keeps the base manifest's URLs when none are given, as promotion does", () => {
    const manifest = buildChannelManifest({ ...base("2.25.0"), urls: [URL] }, undefined, options({ urls: [] }));

    assert.deepEqual(manifest.urls, [URL]);
  });

  it("refuses to publish without download URLs", () => {
    assert.throws(() => buildChannelManifest(base("2.25.0"), undefined, options({ urls: [] })), /No download URLs/);
  });

  it("carries the current revoked list forward and adds new revocations", () => {
    const manifest = buildChannelManifest(
      base("2.25.1"),
      current("2.25.0", { revoked: ["2.24.9"] }),
      options({ revoke: ["2.25.0-beta.2"] }),
    );

    assert.deepEqual(manifest.revoked, ["2.24.9", "2.25.0-beta.2"]);
  });

  it("refuses to go back to an older version unless the current one is revoked", () => {
    assert.throws(
      () => buildChannelManifest(base("2.25.0"), current("2.25.1"), options()),
      /only go back if 2.25.1 is revoked/,
    );

    const rollback = buildChannelManifest(base("2.25.0"), current("2.25.1"), options({ revoke: ["2.25.1"] }));
    assert.equal(rollback.version, "2.25.0");
    assert.deepEqual(rollback.revoked, ["2.25.1"]);
  });

  it("refuses to publish a revoked version", () => {
    assert.throws(
      () => buildChannelManifest(base("2.25.1"), current("2.25.0", { revoked: ["2.25.1"] }), options()),
      /2.25.1 is revoked/,
    );
  });

  it("always issues later than the current manifest, even with a slow clock", () => {
    const manifest = buildChannelManifest(
      base("2.25.1"),
      current("2.25.0", { issuedAt: "2026-10-22T00:00:00.000Z" }),
      options(),
    );

    assert.equal(manifest.issuedAt, "2026-10-22T00:00:00.001Z");
  });

  it("refuses a manifest for another flavor or shell API", () => {
    assert.throws(
      () => buildChannelManifest(base("2.25.1"), current("2.25.0", { flavor: "ow" }), options()),
      /is for ow/,
    );
    assert.throws(
      () => buildChannelManifest(base("2.25.1"), current("2.25.0", { shellApi: 2 }), options()),
      /shell API 2/,
    );
  });

  it("validates the channel name and rollout", () => {
    assert.throws(
      () => buildChannelManifest(base("2.25.0"), undefined, options({ channel: "../x" })),
      /Invalid channel/,
    );
    assert.throws(
      () => buildChannelManifest(base("2.25.0"), undefined, options({ rolloutPercent: 101 })),
      /rolloutPercent/,
    );
    assert.throws(
      () => buildChannelManifest(base("2.25.0"), undefined, options({ rolloutPercent: 12.5 })),
      /rolloutPercent/,
    );
  });
});
