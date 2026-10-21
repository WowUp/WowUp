import { expect } from "chai";
import { generateKeyPairSync } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
  BundleManifest,
  getSignedBytes,
  hashBundleDirectory,
  signManifest,
  UnsignedBundleManifest,
  verifyManifest,
} from "./bundle-manifest";

function generateKeys(): { privateKeyPem: string; publicKeyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

const unsigned: UnsignedBundleManifest = {
  flavor: "wago",
  channel: "stable",
  shellApi: 1,
  version: "2.25.0",
  sha256: "a".repeat(64),
  contentSha256: "b".repeat(64),
  urls: ["https://example.invalid/wago-2.25.0.zip"],
  rolloutPercent: 100,
  revoked: ["2.24.9"],
  issuedAt: "2026-10-20T00:00:00.000Z",
};

describe("bundle-manifest", () => {
  const current = generateKeys();
  const next = generateKeys();
  const publicKeys = { current: current.publicKeyPem, next: next.publicKeyPem };

  it("verifies a manifest signed with a known key", () => {
    const signed = signManifest(unsigned, "current", current.privateKeyPem);

    expect(verifyManifest(signed, publicKeys)).to.equal(true);
  });

  it("verifies a manifest signed with the next key, so keys can rotate", () => {
    expect(verifyManifest(signManifest(unsigned, "next", next.privateKeyPem), publicKeys)).to.equal(true);
  });

  it("rejects a manifest whose fields changed after signing", () => {
    const signed = signManifest(unsigned, "current", current.privateKeyPem);

    expect(verifyManifest({ ...signed, version: "2.24.9" }, publicKeys)).to.equal(false);
    expect(verifyManifest({ ...signed, urls: ["https://evil.invalid/x.zip"] }, publicKeys)).to.equal(false);
    expect(verifyManifest({ ...signed, revoked: [] }, publicKeys)).to.equal(false);
  });

  it("rejects a manifest claiming a different key than the one that signed it", () => {
    const signed = signManifest(unsigned, "current", current.privateKeyPem);

    expect(verifyManifest({ ...signed, keyId: "next" }, publicKeys)).to.equal(false);
  });

  it("rejects a manifest signed with a key the shell doesn't know", () => {
    const stranger = generateKeys();

    expect(verifyManifest(signManifest(unsigned, "current", stranger.privateKeyPem), publicKeys)).to.equal(false);
    expect(verifyManifest(signManifest(unsigned, "unknown", stranger.privateKeyPem), publicKeys)).to.equal(false);
  });

  it("rejects a malformed signature instead of throwing", () => {
    const signed = signManifest(unsigned, "current", current.privateKeyPem);

    expect(verifyManifest({ ...signed, signature: "not base64 !!" }, publicKeys)).to.equal(false);
    expect(verifyManifest({ ...signed, signature: undefined } as unknown as BundleManifest, publicKeys)).to.equal(
      false,
    );
  });

  it("signs the same bytes whatever order the fields are in", () => {
    const reordered = Object.fromEntries(Object.entries({ ...unsigned, keyId: "current" }).reverse()) as unknown;

    expect(getSignedBytes(reordered as UnsignedBundleManifest & { keyId: string })).to.deep.equal(
      getSignedBytes({ ...unsigned, keyId: "current" }),
    );
  });

  it("keeps verifying after a JSON round trip, as a downloaded manifest would", () => {
    const signed = signManifest(unsigned, "current", current.privateKeyPem);
    const downloaded = JSON.parse(JSON.stringify(signed, null, 2)) as BundleManifest;

    expect(verifyManifest(downloaded, publicKeys)).to.equal(true);
  });

  describe("hashBundleDirectory", () => {
    let dirs: string[] = [];

    function makeBundle(files: Record<string, string>): string {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wowup-bundle-"));
      dirs.push(dir);
      for (const [relativePath, content] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, relativePath)), { recursive: true });
        fs.writeFileSync(path.join(dir, relativePath), content);
      }
      return dir;
    }

    afterEach(() => {
      dirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
      dirs = [];
    });

    it("hashes the same files the same way whatever order they were written in", () => {
      const a = makeBundle({ "main.js": "main", "renderer/index.html": "<html>", "assets/a.png": "png" });
      const b = makeBundle({ "assets/a.png": "png", "renderer/index.html": "<html>", "main.js": "main" });

      expect(hashBundleDirectory(a)).to.equal(hashBundleDirectory(b));
    });

    it("changes when a file's content changes", () => {
      const a = makeBundle({ "main.js": "main", "renderer/index.html": "<html>" });
      const b = makeBundle({ "main.js": "main!", "renderer/index.html": "<html>" });

      expect(hashBundleDirectory(a)).to.not.equal(hashBundleDirectory(b));
    });

    it("changes when a file is added, removed or moved", () => {
      const base = hashBundleDirectory(makeBundle({ "main.js": "main", "renderer/index.html": "<html>" }));

      expect(
        hashBundleDirectory(makeBundle({ "main.js": "main", "renderer/index.html": "<html>", "x.js": "" })),
      ).to.not.equal(base);
      expect(hashBundleDirectory(makeBundle({ "main.js": "main" }))).to.not.equal(base);
      expect(hashBundleDirectory(makeBundle({ "main.js": "main", "index.html": "<html>" }))).to.not.equal(base);
    });
  });
});
