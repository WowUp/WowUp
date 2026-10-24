import AdmZip = require("adm-zip");
import { expect } from "chai";
import { generateKeyPairSync } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
  BundleManifest,
  hashBundleDirectory,
  sha256Hex,
  signManifest,
  UnsignedBundleManifest,
} from "../contract/bundle-manifest";
import { BundleUpdateReady } from "../contract/shell-api";
import { BundleLoaderOptions, recordRevoked, selectBundle } from "./bundle-loader";
import { BundleUpdater, checkManifest, decideUpdate, FetchFn, rolloutBucket } from "./bundle-updater";

function generateKeys(): { privateKeyPem: string; publicKeyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

const trusted = generateKeys();
const stranger = generateKeys();

const BASE_URL = "https://bundles.test";
const MANIFEST_URL = `${BASE_URL}/wago/beta/shell-api-1.json`;

interface Served {
  status?: number;
  body?: Buffer | object;
  headers?: Record<string, string>;
}

const silentLog = { info: (): void => {}, warn: (): void => {} };

describe("bundle-updater", () => {
  let base: string;
  let loader: BundleLoaderOptions;
  let served: Map<string, Served>;
  let requests: Array<{ url: string; headers: Record<string, string> }>;

  const fakeFetch: FetchFn = (url, init) => {
    requests.push({ url, headers: init.headers });
    const entry = served.get(url);
    if (entry === undefined) {
      return Promise.reject(new Error("connection refused"));
    }
    const status = entry.status ?? 200;
    const body = entry.body;
    return Promise.resolve({
      status,
      ok: status >= 200 && status < 300,
      headers: new Headers(entry.headers ?? {}),
      json: () => Promise.resolve(body),
      arrayBuffer: () => {
        const buffer = body as Buffer;
        return Promise.resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
      },
    } as unknown as Response);
  };

  function manifestFields(overrides: Partial<UnsignedBundleManifest> = {}): UnsignedBundleManifest {
    return {
      flavor: "wago",
      channel: "beta",
      shellApi: 1,
      version: "2.25.1",
      sha256: "unused",
      contentSha256: "unused",
      urls: [],
      rolloutPercent: 100,
      revoked: [],
      issuedAt: "2026-10-22T00:00:00.000Z",
      ...overrides,
    };
  }

  function sign(fields: UnsignedBundleManifest, privateKeyPem = trusted.privateKeyPem): BundleManifest {
    return signManifest(fields, "test", privateKeyPem);
  }

  /** Builds a bundle zip, serves it, and returns the channel manifest pointing at it */
  function publish(version: string, overrides: Partial<UnsignedBundleManifest> = {}): BundleManifest {
    const source = path.join(base, "source", version);
    fs.mkdirSync(path.join(source, "renderer"), { recursive: true });
    fs.writeFileSync(path.join(source, "main.js"), `// ${version}`);
    fs.writeFileSync(path.join(source, "renderer", "index.html"), "<html></html>");

    const zip = new AdmZip();
    zip.addLocalFolder(source);
    const zipBuffer = zip.toBuffer();
    const zipUrl = `https://downloads.test/wago-${version}.zip`;
    served.set(zipUrl, { body: zipBuffer });

    const manifest = sign(
      manifestFields({
        version,
        sha256: sha256Hex(zipBuffer),
        contentSha256: hashBundleDirectory(source),
        urls: [zipUrl],
        ...overrides,
      }),
    );
    served.set(MANIFEST_URL, { body: manifest });
    return manifest;
  }

  function createUpdater(currentVersion = "2.25.0", baseUrls = [BASE_URL]): BundleUpdater {
    return new BundleUpdater({ loader, baseUrls, currentVersion, fetch: fakeFetch, log: silentLog });
  }

  async function runCheck(updater: BundleUpdater): Promise<BundleUpdateReady[]> {
    const ready: BundleUpdateReady[] = [];
    updater.onReady((update) => ready.push(update));
    updater.setChannel("beta");
    await updater.checkNow();
    return ready;
  }

  function addBuiltIn(version: string): void {
    const root = loader.builtIn.root;
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, "main.js"), `// ${version}`);
    const manifest = sign(manifestFields({ version, contentSha256: hashBundleDirectory(root) }));
    fs.writeFileSync(loader.builtIn.manifestPath, JSON.stringify(manifest));
  }

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), "wowup-updater-"));
    loader = {
      bundlesDir: path.join(base, "userData", "bundles"),
      builtIn: {
        root: path.join(base, "resources", "bundle"),
        manifestPath: path.join(base, "resources", "bundle-manifest.json"),
      },
      trustedKeys: { test: trusted.publicKeyPem },
      shellApi: 1,
      flavor: "wago",
    };
    served = new Map();
    requests = [];
  });

  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  describe("checkManifest", () => {
    it("accepts a signed manifest for this flavor, shell API and channel", () => {
      expect(checkManifest(sign(manifestFields()), loader, "beta", undefined)).to.be.undefined;
    });

    it("refuses a manifest signed with an untrusted key", () => {
      const manifest = sign(manifestFields(), stranger.privateKeyPem);
      expect(checkManifest(manifest, loader, "beta", undefined)).to.contain("signature");
    });

    it("refuses a manifest for another channel, flavor or shell API", () => {
      expect(checkManifest(sign(manifestFields({ channel: "stable" })), loader, "beta", undefined)).to.be.a("string");
      expect(checkManifest(sign(manifestFields({ flavor: "ow" })), loader, "beta", undefined)).to.be.a("string");
      expect(checkManifest(sign(manifestFields({ shellApi: 2 })), loader, "beta", undefined)).to.be.a("string");
    });

    it("refuses a manifest issued before the last accepted one, but not the same one again", () => {
      const manifest = sign(manifestFields({ issuedAt: "2026-10-22T00:00:00.000Z" }));
      expect(checkManifest(manifest, loader, "beta", "2026-10-23T00:00:00.000Z")).to.contain("before");
      expect(checkManifest(manifest, loader, "beta", "2026-10-22T00:00:00.000Z")).to.be.undefined;
    });
  });

  describe("decideUpdate", () => {
    it("installs a newer version", () => {
      expect(decideUpdate(sign(manifestFields({ version: "2.25.1" })), "2.25.0", "id")).to.deep.equal({
        install: true,
        important: false,
      });
    });

    it("skips the running version and older ones", () => {
      expect(decideUpdate(sign(manifestFields({ version: "2.25.0" })), "2.25.0", "id").install).to.be.false;
      expect(decideUpdate(sign(manifestFields({ version: "2.24.0" })), "2.25.0", "id").install).to.be.false;
    });

    it("goes back to an older version, urgently, when the running one is revoked", () => {
      const manifest = sign(manifestFields({ version: "2.24.0", revoked: ["2.25.0"] }));
      expect(decideUpdate(manifest, "2.25.0", "id")).to.deep.equal({ install: true, important: true });
    });

    it("waits for the rollout to reach this install, unless the running version is revoked", () => {
      expect(decideUpdate(sign(manifestFields({ rolloutPercent: 0 })), "2.25.0", "id").install).to.be.false;
      const revoked = sign(manifestFields({ rolloutPercent: 0, revoked: ["2.25.0"] }));
      expect(decideUpdate(revoked, "2.25.0", "id").install).to.be.true;
    });
  });

  describe("rolloutBucket", () => {
    it("is stable for an install and version, and spreads installs across 0-99", () => {
      expect(rolloutBucket("install-a", "2.25.1")).to.equal(rolloutBucket("install-a", "2.25.1"));
      const buckets = new Set(Array.from({ length: 200 }, (_, i) => rolloutBucket(`install-${i}`, "2.25.1")));
      expect(Math.min(...buckets)).to.be.at.least(0);
      expect(Math.max(...buckets)).to.be.below(100);
      expect(buckets.size).to.be.above(50);
    });
  });

  describe("BundleUpdater", () => {
    it("downloads a newer bundle so the next launch loads it, then says it's ready", async () => {
      addBuiltIn("2.25.0");
      publish("2.25.1");

      const ready = await runCheck(createUpdater());

      expect(ready).to.deep.equal([{ version: "2.25.1", important: false }]);
      expect(selectBundle(loader).bundle?.manifest.version).to.equal("2.25.1");
      expect(fs.existsSync(path.join(loader.bundlesDir, ".staging"))).to.be.false;
    });

    it("waits for a channel before checking", async () => {
      publish("2.25.1");

      await createUpdater().checkNow();

      expect(requests).to.be.empty;
    });

    it("doesn't install a download that doesn't match the manifest's sha256", async () => {
      const manifest = publish("2.25.1");
      served.set(manifest.urls[0], { body: Buffer.from("not the zip") });

      const ready = await runCheck(createUpdater());

      expect(ready).to.be.empty;
      expect(fs.existsSync(path.join(loader.bundlesDir, "2.25.1"))).to.be.false;
    });

    it("doesn't install a bundle whose unpacked files don't match the manifest", async () => {
      const published = publish("2.25.1");
      served.set(MANIFEST_URL, {
        body: sign({ ...published, contentSha256: "0".repeat(64) }),
      });

      const ready = await runCheck(createUpdater());

      expect(ready).to.be.empty;
      expect(fs.readdirSync(loader.bundlesDir).filter((name) => name !== "updater.json" && name !== "state.json")).to.be
        .empty;
    });

    it("tries each download URL in order", async () => {
      const published = publish("2.25.1");
      served.set(MANIFEST_URL, { body: sign({ ...published, urls: ["https://down.test/x.zip", ...published.urls] }) });

      const ready = await runCheck(createUpdater());

      expect(ready).to.have.length(1);
      expect(requests.map((request) => request.url)).to.include("https://down.test/x.zip");
    });

    it("tries each manifest host in order", async () => {
      publish("2.25.1");

      const ready = await runCheck(createUpdater("2.25.0", ["https://down.test", BASE_URL]));

      expect(ready).to.have.length(1);
    });

    it("doesn't download again what's already installed, but still says it's ready", async () => {
      publish("2.25.1");
      await runCheck(createUpdater());
      requests = [];

      const ready = await runCheck(createUpdater());

      expect(ready).to.deep.equal([{ version: "2.25.1", important: false }]);
      expect(requests.map((request) => request.url)).to.deep.equal([MANIFEST_URL]);
    });

    it("re-uses the manifest it already has when the host says it hasn't changed", async () => {
      const manifest = publish("2.25.1");
      served.set(MANIFEST_URL, { body: manifest, headers: { etag: '"v1"' } });
      const updater = createUpdater();
      await runCheck(updater);

      served.set(MANIFEST_URL, { status: 304 });
      await updater.checkNow();

      expect(requests[requests.length - 1].headers["If-None-Match"]).to.equal('"v1"');
      expect(fs.existsSync(path.join(loader.bundlesDir, "2.25.1"))).to.be.true;
    });

    it("refuses a replayed manifest older than one it already accepted", async () => {
      publish("2.25.2", { issuedAt: "2026-10-23T00:00:00.000Z" });
      await runCheck(createUpdater());
      publish("2.25.1", { issuedAt: "2026-10-22T00:00:00.000Z" });

      const ready = await runCheck(createUpdater("2.25.0"));

      expect(ready).to.deep.equal([]);
      expect(fs.existsSync(path.join(loader.bundlesDir, "2.25.1"))).to.be.false;
    });

    it("replaces a revoked running bundle, and the loader stops loading it", async () => {
      addBuiltIn("2.25.0");
      publish("2.25.1");
      await runCheck(createUpdater());
      publish("2.25.0", { revoked: ["2.25.1"], issuedAt: "2026-10-23T00:00:00.000Z" });

      const ready = await runCheck(createUpdater("2.25.1"));

      expect(ready).to.deep.equal([{ version: "2.25.0", important: true }]);
      expect(selectBundle(loader).bundle?.source).to.equal("builtin");
    });

    it("doesn't download a version this install has revoked", async () => {
      publish("2.25.1");
      recordRevoked(loader.bundlesDir, ["2.25.1"]);

      const ready = await runCheck(createUpdater());

      expect(ready).to.be.empty;
      expect(requests).to.have.length(1);
    });
  });
});
