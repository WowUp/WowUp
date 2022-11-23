import * as AddonUtils from "../addon.utils";

describe("AddonUtils", () => {
  it("Should convert 9.1.2", () => {
    const gameVersion = AddonUtils.getGameVersion("90102");
    expect(gameVersion).toEqual("9.1.2");
  });

  it("Should convert 9.11.22", () => {
    const gameVersion = AddonUtils.getGameVersion("91122");
    expect(gameVersion).toEqual("9.11.22");
  });

  it("Should accept 9.11.22", () => {
    const gameVersion = AddonUtils.getGameVersion("9.11.22");
    expect(gameVersion).toEqual("9.11.22");
  });

  it("Should accept empty str", () => {
    const gameVersion = AddonUtils.getGameVersion("");
    expect(gameVersion).toEqual("0.0.0");
  });

  it("Should accept undefined", () => {
    const gameVersion = AddonUtils.getGameVersion(undefined);
    expect(gameVersion).toEqual("0.0.0");
  });

  it("Should convert 10.1.2", () => {
    const gameVersion = AddonUtils.getGameVersion("100102");
    expect(gameVersion).toEqual("10.1.2");
  });

  it("Should convert 10.11.22", () => {
    const gameVersion = AddonUtils.getGameVersion("101122");
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
    expect(() => AddonUtils.toInterfaceVersion(undefined)).toThrow(new Error("interface version empty or undefined"));
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
