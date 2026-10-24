import { expect } from "chai";
import { generateKeyPairSync } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { hashBundleDirectory, signManifest, UnsignedBundleManifest } from "../contract/bundle-manifest";
import {
  BundleLoaderOptions,
  getDownloadedStatus,
  markBundleHealthy,
  MAX_UNHEALTHY_BOOTS,
  recordRevoked,
  selectBundle,
} from "./bundle-loader";

function generateKeys(): { privateKeyPem: string; publicKeyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

const trusted = generateKeys();
const stranger = generateKeys();

interface BundleOptions {
  flavor?: string;
  shellApi?: number;
  signedWith?: string;
  manifestVersion?: string;
}

describe("bundle-loader", () => {
  let base: string;
  let options: BundleLoaderOptions;

  function writeBundle(root: string, manifestPath: string, version: string, bundleOptions: BundleOptions = {}): void {
    fs.mkdirSync(path.join(root, "renderer"), { recursive: true });
    fs.writeFileSync(path.join(root, "main.js"), `// ${version}`);
    fs.writeFileSync(path.join(root, "renderer", "index.html"), "<html></html>");

    const manifest: UnsignedBundleManifest = {
      flavor: bundleOptions.flavor ?? "wago",
      channel: "beta",
      shellApi: bundleOptions.shellApi ?? 1,
      version: bundleOptions.manifestVersion ?? version,
      sha256: "unused",
      contentSha256: hashBundleDirectory(root),
      urls: [],
      rolloutPercent: 100,
      revoked: [],
      issuedAt: "2026-10-22T00:00:00.000Z",
    };
    const signed = signManifest(manifest, "test", bundleOptions.signedWith ?? trusted.privateKeyPem);
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(signed));
  }

  function addDownloaded(version: string, bundleOptions?: BundleOptions): string {
    const dir = path.join(options.bundlesDir, version);
    writeBundle(path.join(dir, "bundle"), path.join(dir, "manifest.json"), version, bundleOptions);
    return path.join(dir, "bundle");
  }

  function addBuiltIn(version: string, bundleOptions?: BundleOptions): void {
    writeBundle(options.builtIn.root, options.builtIn.manifestPath, version, bundleOptions);
  }

  function tamper(root: string): void {
    fs.writeFileSync(path.join(root, "main.js"), "// changed after signing");
  }

  function selectedVersion(): string | undefined {
    return selectBundle(options).bundle?.manifest.version;
  }

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), "wowup-loader-"));
    options = {
      bundlesDir: path.join(base, "userData", "bundles"),
      builtIn: {
        root: path.join(base, "resources", "bundle"),
        manifestPath: path.join(base, "resources", "bundle-manifest.json"),
      },
      trustedKeys: { test: trusted.publicKeyPem },
      shellApi: 1,
      flavor: "wago",
    };
  });

  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  describe("selectBundle", () => {
    it("loads the built-in bundle when nothing has been downloaded", () => {
      addBuiltIn("2.25.0");

      const { bundle, rejected } = selectBundle(options);

      expect(bundle?.source).to.equal("builtin");
      expect(bundle?.root).to.equal(options.builtIn.root);
      expect(rejected).to.be.empty;
    });

    it("loads the newest downloaded bundle when it's newer than the built-in one", () => {
      addBuiltIn("2.25.0");
      addDownloaded("2.25.1");
      addDownloaded("2.25.2");

      const { bundle } = selectBundle(options);

      expect(bundle?.source).to.equal("downloaded");
      expect(bundle?.manifest.version).to.equal("2.25.2");
    });

    it("loads the built-in bundle when the installer is newer than any download", () => {
      addBuiltIn("2.26.0");
      addDownloaded("2.25.2");

      expect(selectBundle(options).bundle?.source).to.equal("builtin");
    });

    it("prefers the built-in bundle over a download of the same version", () => {
      addBuiltIn("2.25.2");
      addDownloaded("2.25.2");

      expect(selectBundle(options).bundle?.source).to.equal("builtin");
    });

    it("skips a bundle whose files changed after signing", () => {
      addBuiltIn("2.25.0");
      tamper(addDownloaded("2.25.1"));

      const { bundle, rejected } = selectBundle(options);

      expect(bundle?.source).to.equal("builtin");
      expect(rejected.map((r) => r.reason)).to.deep.equal(["bundle files don't match the manifest"]);
    });

    it("skips a bundle signed with a key the shell doesn't trust", () => {
      addBuiltIn("2.25.0");
      addDownloaded("2.25.1", { signedWith: stranger.privateKeyPem });

      const { bundle, rejected } = selectBundle(options);

      expect(bundle?.manifest.version).to.equal("2.25.0");
      expect(rejected[0].reason).to.match(/signature doesn't verify/);
    });

    it("skips bundles for another flavor, another shell API, or filed under the wrong version", () => {
      addBuiltIn("2.25.0");
      addDownloaded("2.25.3", { flavor: "ow" });
      addDownloaded("2.25.2", { shellApi: 2 });
      addDownloaded("2.25.1", { manifestVersion: "2.25.9" });

      const { bundle, rejected } = selectBundle(options);

      expect(bundle?.source).to.equal("builtin");
      expect(rejected.map((r) => r.reason)).to.include.members([
        "built for the ow flavor, not wago",
        "needs shell API 2, this shell has 1",
        "manifest is for 2.25.9, not 2.25.1",
      ]);
    });

    it("finds nothing to load when the built-in bundle fails its checks and nothing else is there", () => {
      addBuiltIn("2.25.0");
      tamper(options.builtIn.root);

      const { bundle, rejected } = selectBundle(options);

      expect(bundle).to.equal(undefined);
      expect(rejected).to.have.length(1);
    });

    it("finds nothing to load when the built-in manifest is missing", () => {
      expect(selectBundle(options).bundle).to.equal(undefined);
    });
  });

  describe("rollback", () => {
    it(`sets a downloaded bundle aside after ${MAX_UNHEALTHY_BOOTS} starts without marking itself healthy`, () => {
      addBuiltIn("2.25.0");
      addDownloaded("2.25.1");

      for (let i = 0; i < MAX_UNHEALTHY_BOOTS; i++) {
        expect(selectedVersion()).to.equal("2.25.1");
      }

      const { bundle, rejected } = selectBundle(options);
      expect(bundle?.source).to.equal("builtin");
      expect(rejected[0].reason).to.match(/didn't start/);

      // And it stays set aside
      expect(selectBundle(options).rejected[0].reason).to.equal("set aside after failing to start");
    });

    it("falls back to the previous downloaded bundle, not straight to the built-in one", () => {
      addBuiltIn("2.25.0");
      addDownloaded("2.25.1");
      addDownloaded("2.25.2");

      for (let i = 0; i < MAX_UNHEALTHY_BOOTS; i++) {
        selectBundle(options);
      }

      expect(selectedVersion()).to.equal("2.25.1");
    });

    it("keeps a bundle that marks itself healthy", () => {
      addBuiltIn("2.25.0");
      addDownloaded("2.25.1");

      for (let i = 0; i < MAX_UNHEALTHY_BOOTS + 2; i++) {
        const { bundle } = selectBundle(options);
        expect(bundle?.manifest.version).to.equal("2.25.1");
        markBundleHealthy(options, bundle);
      }
    });

    it("never sets the built-in bundle aside, since there's nothing after it", () => {
      addBuiltIn("2.25.0");

      for (let i = 0; i < MAX_UNHEALTHY_BOOTS + 2; i++) {
        expect(selectBundle(options).bundle?.source).to.equal("builtin");
      }
    });

    it("treats an unreadable state file as empty", () => {
      addBuiltIn("2.25.0");
      addDownloaded("2.25.1");
      fs.writeFileSync(path.join(options.bundlesDir, "state.json"), "{ not json");

      expect(selectedVersion()).to.equal("2.25.1");
    });
  });

  describe("revocation", () => {
    it("skips a revoked download", () => {
      addBuiltIn("2.25.0");
      addDownloaded("2.25.1");
      recordRevoked(options.bundlesDir, ["2.25.1"]);

      const { bundle, rejected } = selectBundle(options);

      expect(bundle?.source).to.equal("builtin");
      expect(rejected.map((r) => r.reason)).to.deep.equal(["revoked"]);
    });

    it("loads an older download over a revoked built-in bundle", () => {
      addBuiltIn("2.25.1");
      addDownloaded("2.25.0");
      recordRevoked(options.bundlesDir, ["2.25.1"]);

      expect(selectedVersion()).to.equal("2.25.0");
    });

    it("still loads a revoked built-in bundle when nothing else can be", () => {
      addBuiltIn("2.25.1");
      recordRevoked(options.bundlesDir, ["2.25.1"]);

      expect(selectBundle(options).bundle?.source).to.equal("builtin");
    });

    it("keeps what was revoked before", () => {
      recordRevoked(options.bundlesDir, ["2.25.1"]);
      recordRevoked(options.bundlesDir, ["2.25.2"]);
      addBuiltIn("2.25.0");
      addDownloaded("2.25.1");
      addDownloaded("2.25.2");

      expect(selectBundle(options).bundle?.source).to.equal("builtin");
    });
  });

  describe("getDownloadedStatus", () => {
    it("tells installed, unusable and missing versions apart", () => {
      addDownloaded("2.25.1");
      const tampered = addDownloaded("2.25.2");
      tamper(tampered);
      addDownloaded("2.25.3");
      recordRevoked(options.bundlesDir, ["2.25.3"]);

      expect(getDownloadedStatus(options, "2.25.1")).to.equal("installed");
      expect(getDownloadedStatus(options, "2.25.2")).to.be.undefined;
      expect(getDownloadedStatus(options, "2.25.3")).to.equal("unusable");
      expect(getDownloadedStatus(options, "2.25.4")).to.be.undefined;
    });
  });

  it("ignores folders not named like a version", () => {
    addBuiltIn("2.25.0");
    addDownloaded("2.25.1");
    fs.renameSync(path.join(options.bundlesDir, "2.25.1"), path.join(options.bundlesDir, ".staging"));

    const { bundle, rejected } = selectBundle(options);

    expect(bundle?.source).to.equal("builtin");
    expect(rejected).to.be.empty;
  });

  describe("markBundleHealthy", () => {
    it("keeps the running bundle and the previous good one, and removes the rest", () => {
      addBuiltIn("2.25.0");
      addDownloaded("2.25.1");
      addDownloaded("2.25.2");
      addDownloaded("2.25.3");
      fs.writeFileSync(
        path.join(options.bundlesDir, "state.json"),
        JSON.stringify({ quarantined: [], lastGood: "2.25.2" }),
      );

      const { bundle } = selectBundle(options);
      expect(bundle?.manifest.version).to.equal("2.25.3");
      markBundleHealthy(options, bundle);

      const left = fs.readdirSync(options.bundlesDir).filter((f) => f !== "state.json");
      expect(left.sort()).to.deep.equal(["2.25.2", "2.25.3"]);
    });

    it("removes bundles that were set aside, even newer ones", () => {
      addBuiltIn("2.25.0");
      addDownloaded("2.25.1");
      addDownloaded("2.25.2");
      fs.writeFileSync(path.join(options.bundlesDir, "state.json"), JSON.stringify({ quarantined: ["2.25.2"] }));

      const { bundle } = selectBundle(options);
      expect(bundle?.manifest.version).to.equal("2.25.1");
      markBundleHealthy(options, bundle);

      expect(fs.existsSync(path.join(options.bundlesDir, "2.25.2"))).to.equal(false);
      expect(fs.existsSync(path.join(options.bundlesDir, "2.25.1"))).to.equal(true);
    });

    it("removes revoked bundles, even the previous good one", () => {
      addBuiltIn("2.25.0");
      addDownloaded("2.25.1");
      addDownloaded("2.25.2");
      addDownloaded("2.25.3");
      fs.writeFileSync(
        path.join(options.bundlesDir, "state.json"),
        JSON.stringify({ quarantined: [], lastGood: "2.25.1", revoked: ["2.25.1", "2.25.3"] }),
      );

      const { bundle } = selectBundle(options);
      expect(bundle?.manifest.version).to.equal("2.25.2");
      markBundleHealthy(options, bundle);

      const left = fs.readdirSync(options.bundlesDir).filter((f) => f !== "state.json");
      expect(left).to.deep.equal(["2.25.2"]);
    });

    it("keeps a revoked running bundle and the older replacement waiting for a restart", () => {
      addBuiltIn("2.25.0");
      addDownloaded("2.25.1");
      addDownloaded("2.25.2");
      const { bundle } = selectBundle(options);
      expect(bundle?.manifest.version).to.equal("2.25.2");
      // The updater learns 2.25.2 is revoked and stages 2.25.1 before the window is ready
      recordRevoked(options.bundlesDir, ["2.25.2"]);

      markBundleHealthy(options, bundle);

      const left = fs.readdirSync(options.bundlesDir).filter((f) => f !== "state.json");
      expect(left.sort()).to.deep.equal(["2.25.1", "2.25.2"]);
      expect(selectedVersion()).to.equal("2.25.1");
    });

    it("leaves downloads alone when the built-in bundle is running", () => {
      addBuiltIn("2.26.0");
      addDownloaded("2.25.1");

      const { bundle } = selectBundle(options);
      markBundleHealthy(options, bundle);

      expect(fs.existsSync(path.join(options.bundlesDir, "2.25.1"))).to.equal(true);
    });
  });
});
