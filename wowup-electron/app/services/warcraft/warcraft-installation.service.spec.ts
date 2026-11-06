import { expect } from "chai";
import * as Store from "electron-store";

import { AddonChannelType, WowClientType, WowInstallation } from "wowup-lib-core";

import { WOW_INSTALLATIONS_KEY } from "../../../src/common/constants";
import { WarcraftInstallationService } from "./warcraft-installation.service";

function createInstallation(id: string, clientType: WowClientType, location: string): WowInstallation {
  return {
    id,
    clientType,
    location,
    label: "{{DEFAULT_NAME}}",
    displayName: "",
    selected: false,
    defaultAddonChannelType: AddonChannelType.Stable,
    defaultAutoUpdate: false,
  };
}

function createStore(installations: WowInstallation[]): Store {
  const data: Record<string, unknown> = { [WOW_INSTALLATIONS_KEY]: installations };
  return {
    get: (key: string) => data[key],
    set: (key: string, value: unknown) => {
      data[key] = value;
    },
  } as unknown as Store;
}

describe("WarcraftInstallationService", () => {
  it("migrates a WoW Forever installation saved as Retail", () => {
    const store = createStore([
      createInstallation("forever", WowClientType.Retail, "G:\\Games\\World of Warcraft\\_forever_\\Wow.exe"),
      createInstallation("retail", WowClientType.Retail, "G:\\Games\\World of Warcraft\\_retail_\\Wow.exe"),
    ]);

    const installations = new WarcraftInstallationService(store).getAll();

    expect(installations.find((i) => i.id === "forever")?.clientType).to.equal(WowClientType.Forever);
    expect(installations.find((i) => i.id === "retail")?.clientType).to.equal(WowClientType.Retail);

    const stored = store.get(WOW_INSTALLATIONS_KEY) as WowInstallation[];
    expect(stored.find((i) => i.id === "forever")?.clientType).to.equal(WowClientType.Forever);
  });

  it("leaves the WoW Forever beta (ClassicBeta) alone", () => {
    const store = createStore([
      createInstallation("forever-beta", WowClientType.ClassicBeta, "G:\\World of Warcraft\\_classic_beta_\\WowB.exe"),
    ]);

    const installations = new WarcraftInstallationService(store).getAll();

    expect(installations[0].clientType).to.equal(WowClientType.ClassicBeta);
  });

  describe("setGameVersions", () => {
    it("records game versions by installation id", () => {
      const store = createStore([
        createInstallation("retail", WowClientType.Retail, "G:\\WoW\\_retail_\\Wow.exe"),
        createInstallation("era", WowClientType.ClassicEra, "G:\\WoW\\_classic_era_\\WowClassic.exe"),
      ]);

      const installations = new WarcraftInstallationService(store).setGameVersions({ retail: "12.1.5", era: "1.15.9" });

      expect(installations.find((i) => i.id === "retail")?.gameVersion).to.equal("12.1.5");
      expect(installations.find((i) => i.id === "era")?.gameVersion).to.equal("1.15.9");
    });

    it("clears the game version of installations that are no longer listed", () => {
      const retail = {
        ...createInstallation("retail", WowClientType.Retail, "G:\\WoW\\_retail_\\Wow.exe"),
        gameVersion: "11.1.5",
      };
      const store = createStore([retail]);

      const installations = new WarcraftInstallationService(store).setGameVersions({});

      expect(installations[0].gameVersion).to.equal(undefined);
      expect((store.get(WOW_INSTALLATIONS_KEY) as WowInstallation[])[0].gameVersion).to.equal(undefined);
    });

    it("keeps the dismissed version when the game version changes", () => {
      const retail = {
        ...createInstallation("retail", WowClientType.Retail, "G:\\WoW\\_retail_\\Wow.exe"),
        gameVersion: "11.1.5",
        ignoredCompatibilityVersion: "11.1.5",
      };
      const store = createStore([retail]);

      const installations = new WarcraftInstallationService(store).setGameVersions({ retail: "11.2.0" });

      expect(installations[0].gameVersion).to.equal("11.2.0");
      expect(installations[0].ignoredCompatibilityVersion).to.equal("11.1.5");
    });

    it("does not write to the store when nothing changed", () => {
      const retail = {
        ...createInstallation("retail", WowClientType.Retail, "G:\\WoW\\_retail_\\Wow.exe"),
        gameVersion: "12.1.5",
      };
      const store = createStore([retail]);
      let writes = 0;
      const originalSet = store.set.bind(store);
      (store as unknown as { set: (k: string, v: unknown) => void }).set = (k: string, v: unknown) => {
        writes++;
        originalSet(k, v);
      };

      new WarcraftInstallationService(store).setGameVersions({ retail: "12.1.5" });

      expect(writes).to.equal(0);
    });
  });

  it("only matches _forever_ as a whole path segment", () => {
    const store = createStore([
      createInstallation("retail", WowClientType.Retail, "G:\\my_forever_games\\_retail_\\Wow.exe"),
    ]);

    const installations = new WarcraftInstallationService(store).getAll();

    expect(installations[0].clientType).to.equal(WowClientType.Retail);
  });
});
