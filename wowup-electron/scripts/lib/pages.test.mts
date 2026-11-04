// Run with `npm run test:scripts`.
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { type UnsignedBundleManifest, verifyManifest } from "../../../wowup-shell/contract/bundle-manifest.ts";
import type { ChannelOptions } from "./channel-manifest.mts";
import { publishToPages, splitList } from "./pages.mts";
import { getPublicKeyPem, signWithKey } from "./signing.mts";

const privateKeyPem = generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const sign = (manifest: UnsignedBundleManifest) => signWithKey(manifest, "test", privateKeyPem);

function base(version: string, sha256 = `sha-${version}`): UnsignedBundleManifest {
  return {
    flavor: "wago",
    channel: "beta",
    shellApi: 1,
    version,
    sha256,
    contentSha256: `content-${version}`,
    urls: [],
    rolloutPercent: 100,
    revoked: [],
    issuedAt: "2026-10-01T00:00:00.000Z",
  };
}

function options(overrides: Partial<ChannelOptions> = {}): ChannelOptions {
  return {
    channel: "beta",
    rolloutPercent: 100,
    revoke: [],
    urls: ["https://example.invalid/x.zip"],
    now: new Date(),
    ...overrides,
  };
}

describe("publishToPages", () => {
  let pagesDir: string;
  const channelFile = () => join(pagesDir, "wago", "beta", "shell-api-1.json");
  const recordFile = (version: string) => join(pagesDir, "wago", "versions", `${version}.json`);

  beforeEach(() => {
    pagesDir = mkdtempSync(join(tmpdir(), "wowup-pages-"));
  });

  afterEach(() => {
    rmSync(pagesDir, { recursive: true, force: true });
  });

  it("writes a signed channel manifest and an unsigned version record", () => {
    const { manifest, previous } = publishToPages(pagesDir, base("2.25.0"), options(), sign);

    assert.equal(previous, undefined);
    const written = JSON.parse(readFileSync(channelFile(), "utf8"));
    assert.deepEqual(written, manifest);
    assert.equal(verifyManifest(written, { test: getPublicKeyPem(privateKeyPem) }), true);

    const record = JSON.parse(readFileSync(recordFile("2.25.0"), "utf8"));
    assert.equal(record.signature, undefined);
    assert.equal(record.keyId, undefined);
    assert.deepEqual(record.urls, ["https://example.invalid/x.zip"]);
  });

  it("reports the manifest it replaced", () => {
    publishToPages(pagesDir, base("2.25.0"), options(), sign);
    const { previous } = publishToPages(pagesDir, base("2.25.1"), options(), sign);

    assert.equal(previous?.version, "2.25.0");
  });

  it("refuses to publish a version again with different content, leaving the folder as it was", () => {
    publishToPages(pagesDir, base("2.25.0"), options(), sign);
    const before = readFileSync(channelFile(), "utf8");

    assert.throws(() => publishToPages(pagesDir, base("2.25.0", "other"), options(), sign), /different content/);
    assert.equal(readFileSync(channelFile(), "utf8"), before);
  });

  it("writes nothing when signing fails", () => {
    assert.throws(() =>
      publishToPages(pagesDir, base("2.25.0"), options(), () => {
        throw new Error("no key");
      }),
    );
    assert.equal(existsSync(channelFile()), false);
    assert.equal(existsSync(recordFile("2.25.0")), false);
  });
});

describe("splitList", () => {
  it("accepts repeated and comma-separated values, ignoring blanks", () => {
    assert.deepEqual(splitList(["2.24.9, 2.25.0", "", "2.25.1"]), ["2.24.9", "2.25.0", "2.25.1"]);
  });
});
