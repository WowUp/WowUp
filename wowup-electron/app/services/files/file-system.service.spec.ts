import { expect } from "chai";
import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";

import { FileSystemService } from "./file-system.service";

describe("FileSystemService", () => {
  let root: string;
  let errors: unknown[][];
  let service: FileSystemService;

  beforeEach(async () => {
    root = await fsp.mkdtemp(path.join(os.tmpdir(), "wowup-fs-"));
    errors = [];
    service = new FileSystemService({ error: (...args) => errors.push(args) });

    await fsp.mkdir(path.join(root, "AddonA"));
    await fsp.mkdir(path.join(root, "AddonB"));
    await fsp.writeFile(path.join(root, "AddonA.toc"), "## Title: A");
    await fsp.writeFile(path.join(root, "readme.txt"), "hi");
  });

  afterEach(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  /** Directory junctions need no admin rights on windows, unlike directory symlinks */
  async function linkFolder(target: string, linkName: string): Promise<void> {
    await fsp.symlink(target, path.join(root, linkName), process.platform === "win32" ? "junction" : "dir");
  }

  describe("listDirectories", () => {
    it("lists only the folders", async () => {
      expect((await service.listDirectories(root)).sort()).to.deep.equal(["AddonA", "AddonB"]);
    });

    it("leaves linked folders out unless asked", async () => {
      const outside = await fsp.mkdtemp(path.join(os.tmpdir(), "wowup-fs-target-"));
      try {
        await linkFolder(outside, "Linked");

        expect((await service.listDirectories(root)).sort()).to.deep.equal(["AddonA", "AddonB"]);
        expect((await service.listDirectories(root, true)).sort()).to.deep.equal(["AddonA", "AddonB", "Linked"]);
      } finally {
        await fsp.rm(path.join(root, "Linked"), { force: true });
        await fsp.rm(outside, { recursive: true, force: true });
      }
    });
  });

  describe("listFiles / listEntries", () => {
    it("matches names against the glob", async () => {
      expect(await service.listFiles(root, "*.toc")).to.deep.equal(["AddonA.toc"]);

      const entries = await service.listEntries(root, "Addon*");
      expect(entries.map((e) => [e.name, e.isDirectory, e.isFile]).sort()).to.deep.equal([
        ["AddonA", true, false],
        ["AddonA.toc", false, true],
        ["AddonB", true, false],
      ]);
    });

    it("lists no files for a folder that isn't there", async () => {
      expect(await service.listFiles(path.join(root, "missing"), "*")).to.deep.equal([]);
    });
  });

  describe("pathExists", () => {
    it("says whether the path is there, quietly when it isn't", async () => {
      expect(await service.pathExists(path.join(root, "readme.txt"))).to.equal(true);
      expect(await service.pathExists(path.join(root, "missing.txt"))).to.equal(false);
      expect(await service.pathExists("")).to.equal(false);
      expect(errors).to.deep.equal([]);
    });
  });

  describe("statFiles", () => {
    it("returns each path's stats", async () => {
      const toc = path.join(root, "AddonA.toc");
      const folder = path.join(root, "AddonA");

      const stats = await service.statFiles([toc, folder]);

      expect(Object.keys(stats).sort()).to.deep.equal([folder, toc].sort());
      expect(stats[toc].isFile).to.equal(true);
      expect(stats[toc].size).to.equal("## Title: A".length);
      expect(stats[folder].isDirectory).to.equal(true);
    });

    it("fails when a path can't be stat'd", async () => {
      const err = await service.statFiles([path.join(root, "missing.txt")]).catch((e: unknown) => e);
      expect((err as NodeJS.ErrnoException).code).to.equal("ENOENT");
    });
  });
});
