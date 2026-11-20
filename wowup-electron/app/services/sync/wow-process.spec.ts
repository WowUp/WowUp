import { expect } from "chai";

import { isWowProcessName } from "./wow-process";

describe("isWowProcessName", () => {
  it("recognizes the game on macOS, Windows and Wine", () => {
    expect(
      isWowProcessName(
        "/Applications/World of Warcraft/_retail_/World of Warcraft.app/Contents/MacOS/World of Warcraft",
      ),
    ).to.equal(true);
    expect(isWowProcessName("Wow.exe")).to.equal(true);
    expect(isWowProcessName("WowClassic.exe")).to.equal(true);
    expect(isWowProcessName("Z:\\Games\\World of Warcraft\\_forever_\\Wow-ARM64.exe")).to.equal(true);
  });

  it("ignores the launcher and WowUp itself", () => {
    expect(isWowProcessName("/Applications/Battle.net.app/Contents/MacOS/Battle.net")).to.equal(false);
    expect(isWowProcessName("/Applications/WowUp.app/Contents/MacOS/WowUp")).to.equal(false);
    expect(isWowProcessName("WowUp.exe")).to.equal(false);
  });
});
