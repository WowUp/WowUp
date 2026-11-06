import { expect } from "chai";
import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";

import { WowClientType, WowGameType } from "wowup-lib-core";

import { TocService } from "./toc.service";

// Trimmed from GW2_UI.toc, one toc with a title per game type
const GW2_TOC = [
  "## Interface: 11509, 16001, 20506, 38002, 50504, 120100, 120105",
  "## Author: deadend06, Winglord89(Nils89), nezroy",
  "## RequiredDeps: Core, Data [AllowLoadGameType tbc, wrath]",
  "## Title: |cffffedbaGW2 UI|r |cFF888888Midnight|r [AllowLoadGameType standard]",
  "## Title: |cffffedbaGW2 UI|r |cFF888888Wrath|r [AllowLoadGameType wrath]",
  "## Title: |cffffedbaGW2 UI|r |cFF888888Era|r [AllowLoadGameType vanilla]",
  "## Title: |cffffedbaGW2 UI|r |cFF888888TBC|r [AllowLoadGameType tbc]",
  "## Title: |cffffedbaGW2 UI|r |cFF888888Mists|r [AllowLoadGameType mists]",
  "## Title: |cffffedbaGW2 UI|r |cFF888888Forever|r [AllowLoadGameType camelot][ExcludeLoadGameType standard, classic]",
].join("\r\n");

describe("TocService", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "wowup-toc-"));
  });

  afterEach(async () => {
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  async function writeToc(folder: string, fileName: string, text: string) {
    await fsp.mkdir(path.join(tempDir, folder), { recursive: true });
    await fsp.writeFile(path.join(tempDir, folder, fileName), text);
  }

  it("strips load conditions from values and dependency names", async () => {
    await writeToc("GW2_UI", "GW2_UI.toc", GW2_TOC);

    const toc = await new TocService().parse(path.join(tempDir, "GW2_UI", "GW2_UI.toc"));

    expect(toc.title).to.equal("GW2 UI Midnight");
    expect(toc.dependencyList.map((dep) => dep.trim())).to.deep.equal(["Core", "Data"]);
  });

  it("resolves a title for each game type", async () => {
    await writeToc("GW2_UI", "GW2_UI.toc", GW2_TOC);

    const toc = await new TocService().parse(path.join(tempDir, "GW2_UI", "GW2_UI.toc"));

    expect(toc.titles).to.deep.equal({
      [WowGameType.Retail]: "GW2 UI Midnight",
      [WowGameType.WOTLK]: "GW2 UI Wrath",
      [WowGameType.Classic]: "GW2 UI Era",
      [WowGameType.BurningCrusade]: "GW2 UI TBC",
      [WowGameType.Mists]: "GW2 UI Mists",
      [WowGameType.Forever]: "GW2 UI Forever",
    });
  });

  it("leaves titles unset without load conditions", async () => {
    await writeToc("Plain", "Plain.toc", "## Interface: 120100\n## Title: Plain Addon");

    const toc = await new TocService().parse(path.join(tempDir, "Plain", "Plain.toc"));

    expect(toc.title).to.equal("Plain Addon");
    expect(toc.titles).to.equal(undefined);
  });

  it("returns the toc titled for the installation's game type", async () => {
    await writeToc("GW2_UI", "GW2_UI.toc", GW2_TOC);

    const [classicToc] = await new TocService().getAllTocs(tempDir, ["GW2_UI"], WowClientType.ClassicEra);
    const [anniversaryToc] = await new TocService().getAllTocs(tempDir, ["GW2_UI"], WowClientType.Anniversary);

    expect(classicToc.title).to.equal("GW2 UI Era");
    expect(anniversaryToc.title).to.equal("GW2 UI TBC");
  });
});
