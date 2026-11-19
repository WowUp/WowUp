import { expect } from "chai";
import type * as Store from "electron-store";
import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";

import { InstalledProduct, WowClientType } from "wowup-lib-core";

import { BLIZZARD_AGENT_PATH_KEY } from "../../../src/common/constants";
import { ProductDb } from "../../../src/common/wowup/product-db";
import { TocService } from "../../services/toc/toc.service";
import { WarcraftPlatform } from "../../services/warcraft/warcraft-platform.service";
import { WarcraftController } from "./warcraft.controller";

class FakeStore {
  public readonly values = new Map<string, unknown>();

  public get(key: string): unknown {
    return this.values.get(key);
  }

  public set(key: string, value: unknown): void {
    this.values.set(key, value);
  }

  public delete(key: string): void {
    this.values.delete(key);
  }
}

describe("WarcraftController", () => {
  let tempDir = "";
  let store: FakeStore;
  let scanned: string[];
  let scans: number;

  function controller(): WarcraftController {
    const platform: Partial<WarcraftPlatform> = {
      getBlizzardAgentPaths: () => {
        scans++;
        return Promise.resolve([...scanned]);
      },
      // Turns the Windows location into one inside tempDir
      resolveProducts: (products: InstalledProduct[]) =>
        products.map((product) => ({ ...product, location: path.join(tempDir, product.location.substring(3)) })),
    };

    return new WarcraftController(platform as WarcraftPlatform, store as unknown as Store, {} as TocService);
  }

  async function writeAgent(name: string, client = { location: "C:/World of Warcraft", name: "_retail_" }) {
    const agentPath = path.join(tempDir, name, "product.db");
    await fsp.mkdir(path.dirname(agentPath), { recursive: true });
    const productDb = { products: [{ name: "wow", alias: "wow", family: "wow", client }] };
    await fsp.writeFile(agentPath, ProductDb.encode(productDb).finish());
    return agentPath;
  }

  beforeEach(async () => {
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "wowup-warcraft-controller-"));
    store = new FakeStore();
    scanned = [];
    scans = 0;
  });

  afterEach(async () => {
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  describe("getBlizzardAgentPaths", () => {
    it("searches and stores every product.db when nothing is stored", async () => {
      scanned = [await writeAgent("a"), await writeAgent("b")];

      expect(await controller().getBlizzardAgentPaths()).to.deep.equal(scanned);
      expect(store.get(BLIZZARD_AGENT_PATH_KEY)).to.deep.equal(scanned);
    });

    it("uses the stored paths without searching", async () => {
      const stored = [await writeAgent("a"), await writeAgent("b")];
      store.set(BLIZZARD_AGENT_PATH_KEY, stored);

      expect(await controller().getBlizzardAgentPaths()).to.deep.equal(stored);
      expect(scans).to.equal(0);
    });

    it("reads the single path older versions stored", async () => {
      const stored = await writeAgent("a");
      store.set(BLIZZARD_AGENT_PATH_KEY, stored);

      expect(await controller().getBlizzardAgentPaths()).to.deep.equal([stored]);
    });

    it("searches again when no stored path exists any more", async () => {
      store.set(BLIZZARD_AGENT_PATH_KEY, [path.join(tempDir, "gone", "product.db")]);
      scanned = [await writeAgent("new")];

      expect(await controller().getBlizzardAgentPaths()).to.deep.equal(scanned);
      expect(store.get(BLIZZARD_AGENT_PATH_KEY)).to.deep.equal(scanned);
    });

    it("adds newly found paths to the stored ones on rescan", async () => {
      const stored = await writeAgent("a");
      const added = await writeAgent("b");
      store.set(BLIZZARD_AGENT_PATH_KEY, [stored]);
      scanned = [added, stored];

      expect(await controller().getBlizzardAgentPaths(true)).to.deep.equal([stored, added]);
      expect(store.get(BLIZZARD_AGENT_PATH_KEY)).to.deep.equal([stored, added]);
    });
  });

  describe("getInstalledProducts", () => {
    it("returns the products of every product.db, even of the same client type", async () => {
      const retail = await writeAgent("a", { location: "C:/Lutris/World of Warcraft", name: "_retail_" });
      const otherRetail = await writeAgent("b", { location: "C:/Steam/World of Warcraft", name: "_retail_" });
      const forever = await writeAgent("c", { location: "C:/Steam/World of Warcraft", name: "_forever_" });

      const products = await controller().getInstalledProducts([retail, otherRetail, forever]);

      expect(products.map((product) => [product.clientType, product.location])).to.deep.equal([
        [WowClientType.Retail, path.join(tempDir, "Lutris/World of Warcraft")],
        [WowClientType.Retail, path.join(tempDir, "Steam/World of Warcraft")],
        [WowClientType.Forever, path.join(tempDir, "Steam/World of Warcraft")],
      ]);
    });
  });
});
