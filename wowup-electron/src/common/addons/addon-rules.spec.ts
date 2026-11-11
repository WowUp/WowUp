import { Addon, AddonExternalId, Toc } from "wowup-lib-core";

import {
  containsOwnExternalId,
  insertExternalId,
  isValidExternalAddonId,
  reconcileExternalIds,
  setExternalIds,
} from "./addon-rules";

const ALL_PROVIDERS = new Set(["Curse", "GitHub", "Wago", "TukUI", "WowInterface", "WowUpHub", "RaiderIO"]);

function createAddon(overrides: Partial<Addon> = {}): Addon {
  return { id: "addon-1", name: "Baganator", providerName: "Curse", externalId: "1001", ...overrides } as Addon;
}

describe("addon-rules", () => {
  describe("isValidExternalAddonId", () => {
    it("should accept each provider's own id shape", () => {
      expect(isValidExternalAddonId("Curse", "1001")).toBeTrue();
      expect(isValidExternalAddonId("GitHub", "owner/repo")).toBeTrue();
      expect(isValidExternalAddonId("Wago", "ZQ6aZqKW")).toBeTrue();
      expect(isValidExternalAddonId("TukUI", "8814")).toBeTrue();
      expect(isValidExternalAddonId("WowInterface", "5108")).toBeTrue();
    });

    // Regression: the hub was missing from the table, so hub addons lost their own id
    it("should accept a positive whole number as a hub id", () => {
      expect(isValidExternalAddonId("WowUpHub", "46671")).toBeTrue();
      expect(isValidExternalAddonId("WowUpHub", "0")).toBeFalse();
      expect(isValidExternalAddonId("WowUpHub", "-3")).toBeFalse();
      expect(isValidExternalAddonId("WowUpHub", "abc")).toBeFalse();
    });

    it("should reject ids of the wrong shape", () => {
      expect(isValidExternalAddonId("GitHub", "repo")).toBeFalse();
      expect(isValidExternalAddonId("Wago", "short")).toBeFalse();
      expect(isValidExternalAddonId("Curse", "")).toBeFalse();
    });

    it("should accept no id for a provider without a rule", () => {
      expect(isValidExternalAddonId("Zip", "anything")).toBeFalse();
      expect(isValidExternalAddonId("Nope", "1")).toBeFalse();
    });
  });

  describe("insertExternalId", () => {
    it("should add a valid id once", () => {
      const ids: AddonExternalId[] = [];

      insertExternalId(ids, "WowUpHub", ALL_PROVIDERS, "50");
      insertExternalId(ids, "WowUpHub", ALL_PROVIDERS, "50");

      expect(ids).toEqual([{ id: "50", providerName: "WowUpHub" }]);
    });

    it("should skip providers this build doesn't have, excluded providers, and missing ids", () => {
      const ids: AddonExternalId[] = [];
      spyOn(console, "warn");

      insertExternalId(ids, "Curse", new Set(["Wago"]), "1001");
      insertExternalId(ids, "RaiderIO", ALL_PROVIDERS, "1");
      insertExternalId(ids, "Curse", ALL_PROVIDERS, undefined);

      expect(ids).toEqual([]);
      expect(console.warn).not.toHaveBeenCalled();
    });

    it("should warn about an id its provider couldn't have issued", () => {
      const ids: AddonExternalId[] = [];
      spyOn(console, "warn");

      insertExternalId(ids, "GitHub", ALL_PROVIDERS, "no-slash");

      expect(ids).toEqual([]);
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe("setExternalIds", () => {
    it("should collect the toc's ids and the addon's own", () => {
      const addon = createAddon({ providerName: "WowUpHub", externalId: "31" });
      const toc = { curseProjectId: "1001", wagoAddonId: "ZQ6aZqKW" } as unknown as Toc;

      setExternalIds(addon, toc, ALL_PROVIDERS);

      expect(addon.externalIds).toEqual([
        { id: "1001", providerName: "Curse" },
        { id: "ZQ6aZqKW", providerName: "Wago" },
        { id: "31", providerName: "WowUpHub" },
      ]);
      expect(containsOwnExternalId(addon)).toBeTrue();
    });
  });

  describe("reconcileExternalIds", () => {
    it("should carry over the old addon's ids the new one lacks", () => {
      const newAddon = createAddon({ externalIds: [{ id: "1001", providerName: "Curse" }] });
      const oldAddon = createAddon({
        externalIds: [
          { id: "1001", providerName: "Curse" },
          { id: "ZQ6aZqKW", providerName: "Wago" },
        ],
      });

      reconcileExternalIds(newAddon, oldAddon, ALL_PROVIDERS);

      expect(newAddon.externalIds).toEqual([
        { id: "1001", providerName: "Curse" },
        { id: "ZQ6aZqKW", providerName: "Wago" },
      ]);
    });

    it("should drop ids for providers this build lacks and ids of the wrong shape", () => {
      const newAddon = createAddon({ externalIds: [{ id: "bad", providerName: "WowUpHub" }] });
      const oldAddon = createAddon({ externalIds: [{ id: "77", providerName: "TukUI" }] });

      reconcileExternalIds(newAddon, oldAddon, new Set(["Curse", "WowUpHub"]));

      expect(newAddon.externalIds).toEqual([]);
    });

    it("should not share id objects with the old addon", () => {
      const oldId = { id: "50", providerName: "WowUpHub" };
      const newAddon = createAddon({ externalIds: [] });

      reconcileExternalIds(newAddon, createAddon({ externalIds: [oldId] }), ALL_PROVIDERS);

      expect(newAddon.externalIds?.[0]).toEqual(oldId);
      expect(newAddon.externalIds?.[0]).not.toBe(oldId);
    });
  });
});
