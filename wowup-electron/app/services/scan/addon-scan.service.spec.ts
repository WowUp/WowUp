import { expect } from "chai";
import * as crypto from "crypto";
import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";

import { AddonScanService } from "./addon-scan.service";
import { FileHashAlgorithms, ScanLogger } from "./folder-scan-context";

/**
 * Fingerprints are an addon's identity to the providers, so these are characterization tests: the
 * values below were captured from the scanners as they behaved before they were refactored to share
 * their filesystem work, and they must not move.
 */
const GOLDEN_WOWUP_FINGERPRINT = "df5900e9e7c37399f8a51f67495b9317";
const GOLDEN_CURSE_FINGERPRINT = "3501589137";
const GOLDEN_FILE_COUNT = 5;

/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-member-access */
const nativeHash = require(path.join(process.cwd(), "build/Release/addon.node"));
/* eslint-enable @typescript-eslint/no-var-requires */

const hashes: FileHashAlgorithms = {
  md5: (buffer) => crypto.createHash("md5").update(buffer).digest("hex"),
  murmur: (buffer) => nativeHash.computeHash(buffer, buffer.length) as number,
};

const silentLog: ScanLogger = {
  debug: () => undefined,
  error: () => undefined,
};

/**
 * An addon that exercises the parts of the scan that decide which files count: a toc that pulls in
 * a lua and an xml, an xml that pulls in a further lua, a Bindings.xml picked up on its own, a
 * listed file that does not exist, and a file that matches nothing.
 */
async function writeFixture(): Promise<{ root: string; addonDir: string }> {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "wowup-scan-"));
  const addonDir = path.join(root, "AddOns", "FixtureAddon");
  await fsp.mkdir(path.join(addonDir, "Modules"), { recursive: true });

  await fsp.writeFile(
    path.join(addonDir, "FixtureAddon.toc"),
    ["## Interface: 110000", "# a comment", "Core.lua", "Modules\\Panel.xml", "", "Missing.lua"].join("\r\n"),
  );
  await fsp.writeFile(path.join(addonDir, "Core.lua"), "-- core\nlocal a = 1\n");
  await fsp.writeFile(path.join(addonDir, "Modules", "Panel.xml"), '<Ui><!-- skip --><Script file="Panel.lua"/></Ui>');
  await fsp.writeFile(path.join(addonDir, "Modules", "Panel.lua"), "-- panel\n");
  await fsp.writeFile(path.join(addonDir, "Bindings.xml"), "<Bindings/>");
  await fsp.writeFile(path.join(addonDir, "README.md"), "ignored");

  return { root, addonDir };
}

interface CountingIo {
  io: { readFile: (filePath: string) => Promise<Buffer>; listFiles?: undefined };
  reads: string[];
}

function countingIo(): CountingIo {
  const reads: string[] = [];
  return {
    reads,
    io: {
      readFile: async (filePath: string) => {
        reads.push(filePath);
        return await fsp.readFile(filePath);
      },
      listFiles: undefined,
    },
  };
}

describe("AddonScanService", () => {
  let root: string;
  let addonDir: string;

  beforeEach(async () => {
    ({ root, addonDir } = await writeFixture());
  });

  afterEach(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  function service(io?: Partial<{ readFile: (filePath: string) => Promise<Buffer> }>) {
    return new AddonScanService({ hashes, log: silentLog, io });
  }

  describe("fingerprints", () => {
    it("produces the same wowup fingerprint as before the scanners were shared", async () => {
      const [result] = await service().scanFolders({ filePaths: [addonDir], sources: ["wowup"] });

      expect(result.wowup?.source).to.equal("wowup");
      expect(result.wowup?.fileCount).to.equal(GOLDEN_FILE_COUNT);
      expect(result.wowup?.fingerprint).to.equal(GOLDEN_WOWUP_FINGERPRINT);
    });

    it("does not carry the per file hashes, which nothing reads", () => {
      // They were the majority of the ipc payload and of what the devtools console had to render.
      return service()
        .scanFolders({ filePaths: [addonDir], sources: ["wowup"] })
        .then(([result]) => {
          expect(result.wowup?.fileFingerprints).to.equal(undefined);
        });
    });

    it("produces the same curseforge fingerprint as before the scanners were shared", async () => {
      const [result] = await service().scanFolders({ filePaths: [addonDir], sources: ["curseforge"] });

      expect(result.curseforge?.source).to.equal("curseforge");
      expect(result.curseforge?.fileCount).to.equal(GOLDEN_FILE_COUNT);
      expect(result.curseforge?.fingerprint).to.equal(GOLDEN_CURSE_FINGERPRINT);
      expect(result.curseforge?.fingerprintNum).to.equal(Number(GOLDEN_CURSE_FINGERPRINT));
    });

    it("produces those same fingerprints when both are asked for at once", async () => {
      const [result] = await service().scanFolders({
        filePaths: [addonDir],
        sources: ["wowup", "curseforge"],
      });

      expect(result.wowup?.fingerprint).to.equal(GOLDEN_WOWUP_FINGERPRINT);
      expect(result.curseforge?.fingerprint).to.equal(GOLDEN_CURSE_FINGERPRINT);
    });

    it("reports the folder each result belongs to", async () => {
      const [result] = await service().scanFolders({ filePaths: [addonDir], sources: ["wowup"] });

      expect(result.path).to.equal(addonDir);
      expect(result.wowup?.folderName).to.equal("FixtureAddon");
    });
  });

  describe("shared filesystem work", () => {
    it("reads each matched file exactly once for a single source", async () => {
      const counting = countingIo();
      await service({ readFile: counting.io.readFile }).scanFolders({
        filePaths: [addonDir],
        sources: ["wowup"],
      });

      expect(counting.reads).to.have.lengthOf(GOLDEN_FILE_COUNT);
      expect(new Set(counting.reads).size).to.equal(GOLDEN_FILE_COUNT);
    });

    it("does not read anything a second time when both fingerprints are wanted", async () => {
      const counting = countingIo();
      await service({ readFile: counting.io.readFile }).scanFolders({
        filePaths: [addonDir],
        sources: ["wowup", "curseforge"],
      });

      // The whole point of the change: asking for both costs the same reads as asking for one.
      expect(counting.reads).to.have.lengthOf(GOLDEN_FILE_COUNT);
    });

    it("never reads a lua file that is only there to be hashed more than once", async () => {
      const counting = countingIo();
      await service({ readFile: counting.io.readFile }).scanFolders({
        filePaths: [addonDir],
        sources: ["wowup", "curseforge"],
      });

      const luaReads = counting.reads.filter((p) => p.endsWith("Core.lua"));
      expect(luaReads).to.have.lengthOf(1);
    });
  });

  describe("scanFolders", () => {
    it("returns a bare result per folder when no source is asked for", async () => {
      const results = await service().scanFolders({ filePaths: [addonDir], sources: [] });

      expect(results).to.deep.equal([{ path: addonDir }]);
    });

    it("scans every folder it is given", async () => {
      const second = path.join(root, "AddOns", "SecondAddon");
      await fsp.mkdir(second, { recursive: true });
      await fsp.writeFile(path.join(second, "SecondAddon.toc"), "## Interface: 110000\r\n");

      const results = await service().scanFolders({
        filePaths: [addonDir, second],
        sources: ["wowup"],
      });

      expect(results.map((r) => r.wowup?.folderName)).to.have.members(["FixtureAddon", "SecondAddon"]);
    });

    it("surfaces a folder that cannot be read rather than returning a bad fingerprint", async () => {
      const missing = path.join(root, "AddOns", "DoesNotExist");

      let failed = false;
      try {
        await service().scanFolders({ filePaths: [missing], sources: ["wowup"] });
      } catch {
        failed = true;
      }

      expect(failed).to.equal(true);
    });
  });
});
