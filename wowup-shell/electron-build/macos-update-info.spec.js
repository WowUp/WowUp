const assert = require("assert");

const { macOsToDarwinVersion } = require("./macos-version");
const macOsUpdateInfo = require("./macos-update-info");

function createEvent(nodeName, mac, config = {}) {
  return { packager: { platform: { nodeName }, platformSpecificBuildOptions: mac, config } };
}

describe("macOsToDarwinVersion", () => {
  it("maps macOS versions to the Darwin version os.release() reports", () => {
    assert.strictEqual(macOsToDarwinVersion("11.0"), "20.0.0");
    assert.strictEqual(macOsToDarwinVersion("12.0"), "21.0.0");
    assert.strictEqual(macOsToDarwinVersion("12.3.1"), "21.0.0");
    assert.strictEqual(macOsToDarwinVersion("15"), "24.0.0");
  });

  it("knows macOS 26 is Darwin 25", () => {
    assert.strictEqual(macOsToDarwinVersion("26.0"), "25.0.0");
  });

  it("throws for versions it doesn't know", () => {
    assert.throws(() => macOsToDarwinVersion("10.15"), /No Darwin version known/);
    assert.throws(() => macOsToDarwinVersion("27.0"), /No Darwin version known/);
    assert.throws(() => macOsToDarwinVersion("abc"), /No Darwin version known/);
  });
});

describe("macos-update-info hook", () => {
  it("adds the Darwin minimum to the mac release info", () => {
    const mac = { minimumSystemVersion: "12.0" };
    macOsUpdateInfo(createEvent("darwin", mac));
    assert.deepStrictEqual(mac.releaseInfo, { minimumSystemVersion: "21.0.0" });
  });

  it("keeps release info from the mac or top-level config", () => {
    const mac = { minimumSystemVersion: "12.0", releaseInfo: { releaseName: "mac" } };
    macOsUpdateInfo(createEvent("darwin", mac, { releaseInfo: { releaseName: "top" } }));
    assert.deepStrictEqual(mac.releaseInfo, { releaseName: "mac", minimumSystemVersion: "21.0.0" });

    const mac2 = { minimumSystemVersion: "12.0" };
    macOsUpdateInfo(createEvent("darwin", mac2, { releaseInfo: { vendor: "WowUp" } }));
    assert.deepStrictEqual(mac2.releaseInfo, { vendor: "WowUp", minimumSystemVersion: "21.0.0" });
  });

  it("fails the build when the mac config has no minimum", () => {
    assert.throws(() => macOsUpdateInfo(createEvent("darwin", {})), /mac.minimumSystemVersion must be set/);
  });

  it("leaves other platforms alone", () => {
    const win = {};
    macOsUpdateInfo(createEvent("win32", win));
    assert.deepStrictEqual(win, {});
  });
});
