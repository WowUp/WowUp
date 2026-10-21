import { expect } from "chai";

import { getBlizzardAgentCandidates, WarcraftPlatformWin } from "./warcraft-platform.win";

const C_AGENT = "C:\\ProgramData\\Battle.net\\Agent\\product.db";
const D_AGENT = "D:\\ProgramData\\Battle.net\\Agent\\product.db";

function platformWith(existing: string[], programData: string | undefined = "C:\\ProgramData"): WarcraftPlatformWin {
  return new WarcraftPlatformWin({
    pathExists: (filePath) => Promise.resolve(existing.includes(filePath)),
    programData,
  });
}

describe("WarcraftPlatformWin blizzard agent search", () => {
  describe("getBlizzardAgentCandidates", () => {
    it("checks %ProgramData% before any drive", () => {
      const candidates = getBlizzardAgentCandidates("E:\\Data");

      expect(candidates[0]).to.equal("E:\\Data\\Battle.net\\Agent\\product.db");
    });

    it("checks the ProgramData folder on every drive letter, in order", () => {
      const candidates = getBlizzardAgentCandidates(undefined);

      expect(candidates).to.have.length(26);
      expect(candidates[0]).to.equal("A:\\ProgramData\\Battle.net\\Agent\\product.db");
      expect(candidates[2]).to.equal(C_AGENT);
      expect(candidates[25]).to.equal("Z:\\ProgramData\\Battle.net\\Agent\\product.db");
    });

    it("doesn't check the same folder twice when %ProgramData% is a drive's ProgramData", () => {
      const candidates = getBlizzardAgentCandidates("c:\\programdata");

      expect(candidates).to.have.length(26);
      expect(candidates[0]).to.equal("c:\\programdata\\Battle.net\\Agent\\product.db");
      expect(candidates.slice(1).map((c) => c.toLowerCase())).to.not.include(C_AGENT.toLowerCase());
    });
  });

  describe("getBlizzardAgentPath", () => {
    it("finds the agent on a drive other than C:", async () => {
      expect(await platformWith([D_AGENT]).getBlizzardAgentPath()).to.equal(D_AGENT);
    });

    it("prefers %ProgramData% over other drives", async () => {
      const programDataAgent = "E:\\Data\\Battle.net\\Agent\\product.db";

      expect(await platformWith([D_AGENT, programDataAgent], "E:\\Data").getBlizzardAgentPath()).to.equal(
        programDataAgent,
      );
    });

    it("prefers the earlier drive letter when several drives have one", async () => {
      const fAgent = "F:\\ProgramData\\Battle.net\\Agent\\product.db";

      expect(await platformWith([fAgent, D_AGENT], undefined).getBlizzardAgentPath()).to.equal(D_AGENT);
    });

    it("returns an empty string when there's no agent", async () => {
      expect(await platformWith([]).getBlizzardAgentPath()).to.equal("");
    });
  });
});
