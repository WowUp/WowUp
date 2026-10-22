import { Addon } from "wowup-lib-core";

import { getAllProviders, getProviders, hasMultipleProviders } from "./addon.utils";

describe("addon.utils providers", () => {
  function createAddon(overrides: Partial<Addon> = {}): Addon {
    return {
      providerName: "Wago",
      externalId: "abc",
      externalIds: [
        { id: "777", providerName: "WowInterface" },
        { id: "abc", providerName: "Wago" },
        { id: "1001", providerName: "Curse" },
        { id: "1001", providerName: "CurseV2" },
        { id: "50", providerName: "WowUpHub" },
      ],
      ...overrides,
    } as Addon;
  }

  const wagoBuild = (providerName: string) => ["Wago", "WowInterface", "WowUpHub"].includes(providerName);

  it("should list every external id when no availability check is given", () => {
    const names = getAllProviders(createAddon()).map((extId) => extId.providerName);

    expect(names).toEqual(["Curse", "CurseV2", "Wago", "WowInterface", "WowUpHub"]);
  });

  it("should leave out providers that are not available", () => {
    const names = getAllProviders(createAddon(), wagoBuild).map((extId) => extId.providerName);

    expect(names).toEqual(["Wago", "WowInterface", "WowUpHub"]);
  });

  it("should always keep the addon's own provider", () => {
    const addon = createAddon({ providerName: "CurseV2", externalId: "1001" });

    const names = getAllProviders(addon, wagoBuild).map((extId) => extId.providerName);

    expect(names).toContain("CurseV2");
  });

  it("should only offer other available providers to switch to", () => {
    const names = getProviders(createAddon(), wagoBuild).map((extId) => extId.providerName);

    expect(names).toEqual(["WowInterface", "WowUpHub"]);
  });

  it("should not report multiple providers when the others are all unavailable", () => {
    const addon = createAddon({
      externalIds: [
        { id: "abc", providerName: "Wago" },
        { id: "1001", providerName: "CurseV2" },
      ],
    });

    expect(hasMultipleProviders(addon)).toBeTrue();
    expect(hasMultipleProviders(addon, wagoBuild)).toBeFalse();
  });
});
