import { expect } from "chai";
import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";

import { WowClientType } from "wowup-lib-core";

import { ProductDb } from "../../../src/common/wowup/product-db";
import { decodeProducts, toGameVersion } from "./warcraft-platform.service";

describe("toGameVersion", () => {
  it("strips the build number", () => {
    expect(toGameVersion("12.1.5.70688")).to.equal("12.1.5");
    expect(toGameVersion("1.60.1.70707")).to.equal("1.60.1");
  });

  it("returns undefined for missing or malformed versions", () => {
    expect(toGameVersion(undefined)).to.equal(undefined);
    expect(toGameVersion("")).to.equal(undefined);
    expect(toGameVersion("3.3.93847")).to.equal(undefined);
    expect(toGameVersion("a.b.c.d")).to.equal(undefined);
  });
});

describe("decodeProducts", () => {
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "wowup-product-db-"));
  });

  afterEach(async () => {
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  it("reads the game version of wow products from installInfo", async () => {
    // encode takes plain objects; create() would lose them to the decorated classes' field initializers
    const productDb = {
      products: [
        {
          name: "wow",
          alias: "wow",
          family: "wow",
          client: { location: "G:/Games/World of Warcraft", name: "_retail_" },
          installInfo: { versionInfo: { version: "12.1.5.70688" } },
        },
        {
          name: "wow_classic_era",
          alias: "wow_classic_era",
          family: "wow",
          client: { location: "G:/Games/World of Warcraft", name: "_classic_era_" },
        },
        {
          name: "fenris",
          alias: "fenris",
          family: "fenris",
          client: { location: "G:/Games/Diablo IV", name: "" },
          installInfo: { versionInfo: { version: "3.2.4.74043" } },
        },
      ],
    };

    const dbPath = path.join(tempDir, "product.db");
    await fsp.writeFile(dbPath, ProductDb.encode(productDb).finish());

    const products = await decodeProducts(dbPath);

    expect(products).to.have.length(2);
    expect(products[0].clientType).to.equal(WowClientType.Retail);
    expect(products[0].gameVersion).to.equal("12.1.5");
    expect(products[1].clientType).to.equal(WowClientType.ClassicEra);
    expect(products[1].gameVersion).to.equal(undefined);
  });
});
