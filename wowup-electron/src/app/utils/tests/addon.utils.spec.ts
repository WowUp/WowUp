import { AddonChannelType, getGameVersion, WowClientType, WowInstallation } from "wowup-lib-core";
import * as AddonUtils from "../addon.utils";

describe("AddonUtils", () => {
  it("Should convert 9.1.2", () => {
    const gameVersion = getGameVersion("90102");
    expect(gameVersion).toEqual("9.1.2");
  });

  it("Should convert 9.11.22", () => {
    const gameVersion = getGameVersion("91122");
    expect(gameVersion).toEqual("9.11.22");
  });

  it("Should accept 9.11.22", () => {
    const gameVersion = getGameVersion("9.11.22");
    expect(gameVersion).toEqual("9.11.22");
  });

  it("Should accept empty str", () => {
    const gameVersion = getGameVersion("");
    expect(gameVersion).toEqual("0.0.0");
  });

  it("Should accept undefined", () => {
    const gameVersion = getGameVersion(undefined);
    expect(gameVersion).toEqual("0.0.0");
  });

  it("Should convert 10.1.2", () => {
    const gameVersion = getGameVersion("100102");
    expect(gameVersion).toEqual("10.1.2");
  });

  it("Should convert 10.11.22", () => {
    const gameVersion = getGameVersion("101122");
    expect(gameVersion).toEqual("10.11.22");
  });

  it("Should interface 9.1.2", () => {
    const gameVersion = AddonUtils.toInterfaceVersion("9.1.2");
    expect(gameVersion).toEqual("90102");
  });


  it("Should interface 10.0", () => {
    const gameVersion = AddonUtils.toInterfaceVersion("10.0");
    expect(gameVersion).toEqual("100000");
  });

  it("Should interface 9.11.22", () => {
    const gameVersion = AddonUtils.toInterfaceVersion("9.11.22");
    expect(gameVersion).toEqual("91122");
  });

  it("Should interface 90102", () => {
    const gameVersion = AddonUtils.toInterfaceVersion("90102");
    expect(gameVersion).toEqual("90102");
  });

  it("Should throw interface empty str", () => {
    expect(() => AddonUtils.toInterfaceVersion("")).toThrow(new Error("interface version empty or undefined"));
  });

  it("Should throw interface undefined", () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    expect(() => AddonUtils.toInterfaceVersion(undefined as any)).toThrow(
      new Error("interface version empty or undefined"),
    );
  });

  it("Should interface 10.1.2", () => {
    const gameVersion = AddonUtils.toInterfaceVersion("10.1.2");
    expect(gameVersion).toEqual("100102");
  });

  it("Should Interface 10.11.22", () => {
    const gameVersion = AddonUtils.toInterfaceVersion("10.11.22");
    expect(gameVersion).toEqual("101122");
  });
});

describe("isAddonVersionCompatible", () => {
  const isCompatible = AddonUtils.isAddonVersionCompatible;

  it("is compatible when the client is on the target version or newer", () => {
    expect(isCompatible(["12.1.5"], "12.1.5")).toBeTrue();
    expect(isCompatible(["12.1.0"], "12.1.5")).toBeTrue();
    expect(isCompatible(["11.2.7"], "12.1.5")).toBeTrue();
  });

  it("is incompatible when the target is newer than the client", () => {
    expect(isCompatible(["12.1.7"], "12.1.5")).toBeFalse();
    expect(isCompatible(["12.2.0"], "12.1.5")).toBeFalse();
    expect(isCompatible(["13.0.0"], "12.1.5")).toBeFalse();
  });

  it("compares numerically, not as text", () => {
    expect(isCompatible(["12.10.0"], "12.9.0")).toBeFalse();
    expect(isCompatible(["12.9.0"], "12.10.0")).toBeTrue();
  });

  it("accepts interface numbers and build suffixes", () => {
    expect(isCompatible(["120107"], "12.1.5")).toBeFalse();
    expect(isCompatible(["120105"], "12.1.5.70688")).toBeTrue();
    expect(isCompatible("12.1.7", "12.1.5")).toBeFalse();
  });

  it("pads versions that are missing the patch", () => {
    expect(isCompatible(["12.2"], "12.1.5")).toBeFalse();
    expect(isCompatible(["12.1"], "12.1.5")).toBeTrue();
  });

  it("is compatible when any target of the client's flavor is old enough", () => {
    expect(isCompatible(["12.1.0", "12.1.7"], "12.1.5")).toBeTrue();
    expect(isCompatible(["12.1.6", "12.1.7"], "12.1.5")).toBeFalse();
  });

  it("only looks at targets of the client's own flavor", () => {
    // a release for retail 12.1.7 and classic era 1.15.9 says nothing about era 1.15.8's retail target
    expect(isCompatible(["12.1.7", "1.15.9"], "1.15.8")).toBeFalse();
    expect(isCompatible(["12.1.7", "1.15.8"], "1.15.8")).toBeTrue();
    expect(isCompatible(["12.1.7", "5.5.4"], "12.1.5")).toBeFalse();
  });

  it("does not mix classic era with forever", () => {
    expect(isCompatible(["1.60.2"], "1.15.9")).toBeTrue();
    expect(isCompatible(["1.15.9"], "1.60.1")).toBeTrue();
    expect(isCompatible(["1.60.2"], "1.60.1")).toBeFalse();
    expect(isCompatible(["1.15.10"], "1.15.9")).toBeFalse();
  });

  it("does not mix classic expansions", () => {
    expect(isCompatible(["5.5.5", "2.5.7"], "2.5.6")).toBeFalse();
    expect(isCompatible(["5.5.5"], "2.5.6")).toBeTrue();
  });

  it("fails open when a version is missing or unreadable", () => {
    expect(isCompatible(undefined, "12.1.5")).toBeTrue();
    expect(isCompatible([], "12.1.5")).toBeTrue();
    expect(isCompatible(["Retail", "abc", ""], "12.1.5")).toBeTrue();
    expect(isCompatible(["13.0.0"], undefined)).toBeTrue();
    expect(isCompatible(["13.0.0"], "")).toBeTrue();
    expect(isCompatible(["13.0.0"], "garbage")).toBeTrue();
  });

  it("ignores unreadable targets next to readable ones", () => {
    expect(isCompatible(["Retail", "12.1.7"], "12.1.5")).toBeFalse();
  });
});

describe("getRequiredGameVersion", () => {
  it("returns the oldest version of the client's flavor that the release targets", () => {
    expect(AddonUtils.getRequiredGameVersion(["12.1.9", "12.1.7"], "12.1.5")).toEqual("12.1.7");
  });

  it("ignores targets of other flavors", () => {
    expect(AddonUtils.getRequiredGameVersion(["1.15.9", "12.1.7"], "12.1.5")).toEqual("12.1.7");
  });

  it("shows interface numbers as game versions", () => {
    expect(AddonUtils.getRequiredGameVersion(["120107"], "12.1.5")).toEqual("12.1.7");
  });

  it("returns nothing when the client or the release is unknown", () => {
    expect(AddonUtils.getRequiredGameVersion(["12.1.7"], undefined)).toBeUndefined();
    expect(AddonUtils.getRequiredGameVersion(undefined, "12.1.5")).toBeUndefined();
    expect(AddonUtils.getRequiredGameVersion(["1.15.9"], "12.1.5")).toBeUndefined();
  });
});

describe("getNewestVersionOfInstalledFlavor", () => {
  it("returns the newest version of the installed flavor", () => {
    expect(AddonUtils.getNewestVersionOfInstalledFlavor(["12.1.0", "12.1.7", "12.1.5"], "12.1.5")).toEqual("12.1.7");
  });

  it("ignores other flavors and unreadable versions", () => {
    expect(AddonUtils.getNewestVersionOfInstalledFlavor(["Retail", "1.15.9", "12.1.0"], "12.1.5")).toEqual("12.1.0");
  });

  it("returns nothing without a match or a known client", () => {
    expect(AddonUtils.getNewestVersionOfInstalledFlavor(["1.15.9"], "12.1.5")).toBeUndefined();
    expect(AddonUtils.getNewestVersionOfInstalledFlavor(["12.1.0"], undefined)).toBeUndefined();
  });
});

describe("getFileTargetVersions", () => {
  it("prefers the list of game versions over the single one", () => {
    expect(AddonUtils.getFileTargetVersions({ gameVersion: "12.1.0", gameVersions: ["12.1.7", "12.1.5"] })).toEqual([
      "12.1.7",
      "12.1.5",
    ]);
  });

  it("falls back to the single game version", () => {
    expect(AddonUtils.getFileTargetVersions({ gameVersion: "12.1.7" })).toEqual(["12.1.7"]);
    expect(AddonUtils.getFileTargetVersions({ gameVersion: "12.1.7", gameVersions: [] })).toEqual(["12.1.7"]);
  });

  it("drops tags and empty values providers list next to versions", () => {
    expect(AddonUtils.getFileTargetVersions({ gameVersions: ["Retail", "12.1.7", ""] })).toEqual(["12.1.7"]);
    expect(AddonUtils.getFileTargetVersions({ gameVersion: "" })).toEqual([]);
    expect(AddonUtils.getFileTargetVersions({})).toEqual([]);
  });
});

describe("isAddonCompatibleWithInstallation", () => {
  const installation = (overrides: Partial<WowInstallation> = {}): WowInstallation => ({
    id: "retail",
    clientType: WowClientType.Retail,
    location: "G:/WoW/_retail_/Wow.exe",
    label: "Retail",
    displayName: "Retail",
    selected: false,
    defaultAddonChannelType: AddonChannelType.Stable,
    defaultAutoUpdate: false,
    gameVersion: "12.1.5",
    ...overrides,
  });

  it("flags a release that targets a newer game version", () => {
    expect(AddonUtils.isAddonCompatibleWithInstallation(["12.1.7"], installation())).toBeFalse();
  });

  it("accepts a release the client can run", () => {
    expect(AddonUtils.isAddonCompatibleWithInstallation(["12.1.5"], installation())).toBeTrue();
  });

  it("does not check PTR or beta clients", () => {
    for (const clientType of [WowClientType.RetailPtr, WowClientType.RetailXPtr, WowClientType.Beta]) {
      expect(AddonUtils.isAddonCompatibleWithInstallation(["12.1.7"], installation({ clientType }))).toBeTrue();
    }
  });

  it("does not check installations with an unknown game version", () => {
    expect(AddonUtils.isAddonCompatibleWithInstallation(["12.1.7"], installation({ gameVersion: undefined }))).toBeTrue();
    expect(AddonUtils.isAddonCompatibleWithInstallation(["12.1.7"], undefined)).toBeTrue();
  });

  it("honors a dismissal made for the current game version", () => {
    const ignored = installation({ ignoredCompatibilityVersion: "12.1.5" });
    expect(AddonUtils.isCompatibilityIgnored(ignored)).toBeTrue();
    expect(AddonUtils.isAddonCompatibleWithInstallation(["12.1.7"], ignored)).toBeTrue();
  });

  it("stops honoring a dismissal once the game version changes", () => {
    const patched = installation({ gameVersion: "12.1.7", ignoredCompatibilityVersion: "12.1.5" });
    expect(AddonUtils.isCompatibilityIgnored(patched)).toBeFalse();
    expect(AddonUtils.isAddonCompatibleWithInstallation(["12.2.0"], patched)).toBeFalse();
  });
});
