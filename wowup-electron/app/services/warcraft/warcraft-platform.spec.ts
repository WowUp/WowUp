import { expect } from "chai";

import { getTocForGameType, getWowGameType, WowClientType, WowGameType } from "wowup-lib-core";

import { WarcraftPlatformLinux } from "./warcraft-platform.linux";
import { WarcraftPlatformMac } from "./warcraft-platform.mac";
import { WarcraftPlatformWin } from "./warcraft-platform.win";

// WoW Forever ships the retail binary, so it can only be told apart from retail by its install folder
describe("WoW Forever client detection", () => {
  describe("WarcraftPlatformWin", () => {
    const platform = new WarcraftPlatformWin();
    const exe = process.arch === "arm64" ? "Wow-arm64.exe" : "Wow.exe";

    it("detects Wow.exe in _forever_ as Forever", () => {
      expect(platform.getClientType(`G:\\Games\\World of Warcraft\\_forever_\\${exe}`)).to.equal(WowClientType.Forever);
    });

    it("still detects Wow.exe in _retail_ as Retail", () => {
      expect(platform.getClientType(`G:\\Games\\World of Warcraft\\_retail_\\${exe}`)).to.equal(WowClientType.Retail);
    });

    it("uses the retail binary name for Forever", () => {
      expect(platform.getExecutableName(WowClientType.Forever)).to.equal(exe);
    });

    // The Forever beta still lives in _classic_beta_ and ships the retail beta binary
    it("still detects the retail beta binary in _classic_beta_ as ClassicBeta", () => {
      const betaExe = process.arch === "arm64" ? "WowB-arm64.exe" : "WowB.exe";
      expect(platform.getClientType(`G:\\World of Warcraft\\_classic_beta_\\${betaExe}`)).to.equal(
        WowClientType.ClassicBeta,
      );
    });
  });

  describe("WarcraftPlatformMac", () => {
    const platform = new WarcraftPlatformMac();

    it("detects the retail app in _forever_ as Forever", () => {
      expect(platform.getClientType("/Applications/World of Warcraft/_forever_/World of Warcraft.app")).to.equal(
        WowClientType.Forever,
      );
    });

    it("still detects the retail app in _retail_ as Retail", () => {
      expect(platform.getClientType("/Applications/World of Warcraft/_retail_/World of Warcraft.app")).to.equal(
        WowClientType.Retail,
      );
    });
  });

  describe("WarcraftPlatformLinux", () => {
    const platform = new WarcraftPlatformLinux();

    it("detects Wow.exe in _forever_ as Forever", () => {
      expect(platform.getClientType("/home/user/Games/World of Warcraft/_forever_/Wow.exe")).to.equal(
        WowClientType.Forever,
      );
    });

    it("still detects Wow.exe in _retail_ as Retail", () => {
      expect(platform.getClientType("/home/user/Games/World of Warcraft/_retail_/Wow.exe")).to.equal(
        WowClientType.Retail,
      );
    });
  });

  describe("wowup-lib-core", () => {
    it("maps Forever to the forever game type", () => {
      expect(getWowGameType(WowClientType.Forever)).to.equal(WowGameType.Forever);
    });

    it("keeps the Forever beta (ClassicBeta) on the forever game type", () => {
      expect(getWowGameType(WowClientType.ClassicBeta)).to.equal(WowGameType.Forever);
    });

    it("prefers the -Forever toc for Forever", () => {
      const tocs = ["BigWigs.toc", "BigWigs_Mainline.toc", "BigWigs_Vanilla.toc", "BigWigs_Forever.toc"];
      expect(getTocForGameType(tocs, WowClientType.Forever)).to.equal("BigWigs_Forever.toc");
    });

    it("falls back to the base toc for Forever", () => {
      const tocs = ["BigWigs.toc", "BigWigs_Mainline.toc", "BigWigs_Vanilla.toc"];
      expect(getTocForGameType(tocs, WowClientType.Forever)).to.equal("BigWigs.toc");
    });
  });
});
