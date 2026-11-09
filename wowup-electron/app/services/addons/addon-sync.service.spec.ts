import { expect } from "chai";
import * as Store from "electron-store";
import {
  Addon,
  AddonChannelType,
  AddonFolder,
  AddonWarningType,
  Toc,
  WowClientType,
  WowInstallation,
} from "wowup-lib-core";

import { ADDON_PROVIDER_UNKNOWN } from "../../../src/common/constants";
import { AddonScanRequest, FolderScanResults } from "../../../src/common/models/addon-scan";
import { AddonRepository } from "./addon-repository";
import { AddonSyncDeps, AddonSyncService } from "./addon-sync.service";

const silentLog = { debug: () => undefined, info: () => undefined, warn: () => undefined };

const installation: WowInstallation = {
  id: "install-1",
  clientType: WowClientType.Retail,
  location: "wow/_retail_/Wow.exe",
  label: "Retail",
  displayName: "Retail",
  selected: true,
  defaultAddonChannelType: AddonChannelType.Beta,
  defaultAutoUpdate: true,
};

function createToc(fileName: string, overrides: Partial<Toc> = {}): Toc {
  return {
    fileName,
    filePath: fileName,
    interface: ["110200"],
    title: fileName.replace(".toc", ""),
    version: "1.0.0",
    dependencyList: [],
    ...overrides,
  } as unknown as Toc;
}

function createFolder(name: string, overrides: Partial<AddonFolder> = {}): AddonFolder {
  return { name, path: `AddOns/${name}`, status: "Pending", tocs: [createToc(`${name}.toc`)], ...overrides };
}

function createAddon(overrides: Partial<Addon> = {}): Addon {
  return {
    id: "addon-1",
    name: "Baganator",
    providerName: "Curse",
    externalId: "1001",
    channelType: AddonChannelType.Stable,
    installationId: installation.id,
    installedFolderList: ["Baganator"],
    isIgnored: false,
    autoUpdateEnabled: false,
    ...overrides,
  } as Addon;
}

describe("AddonSyncService", () => {
  let store: Map<string, unknown>;
  let folders: AddonFolder[];
  let gitFolders: string[];
  let fingerprintRequests: AddonScanRequest[];
  let service: AddonSyncService;
  let idCt: number;
  let scanSymlinks: boolean;
  let listCalls: Array<[string, boolean]>;

  function stored(): Addon[] {
    return [...store.values()] as Addon[];
  }

  beforeEach(() => {
    store = new Map();
    folders = [];
    gitFolders = [];
    fingerprintRequests = [];
    idCt = 0;
    scanSymlinks = false;
    listCalls = [];

    const deps: AddonSyncDeps = {
      repository: new AddonRepository(store as unknown as Store),
      getInstallations: () => [installation],
      getAddonFolderPath: () => "AddOns",
      listAddons: (addonFolderPath, scanSymlinks) => {
        listCalls.push([addonFolderPath, scanSymlinks]);
        return Promise.resolve(folders);
      },
      getScanSymlinks: () => scanSymlinks,
      fingerprintSources: ["wowup"],
      listDirectories: (dirPath) => Promise.resolve(gitFolders.some((g) => dirPath.endsWith(g)) ? [".git"] : []),
      getFingerprints: (request) => {
        fingerprintRequests.push(request);
        return Promise.resolve(
          request.filePaths.map(
            (path): FolderScanResults => ({
              path,
              wowup: { folderName: path, fingerprint: `wowup:${path}` } as any,
              curseforge: { folderName: path, fingerprint: `cf:${path}` } as any,
            }),
          ),
        );
      },
      getLatestDirUpdateTime: () => Promise.resolve(Date.parse("2026-01-01")),
      newId: () => `id-${++idCt}`,
      log: silentLog,
    };
    service = new AddonSyncService(deps);
  });

  describe("prepareScan", () => {
    const prepare = (nonRescanProviders?: string[]) =>
      service.prepareScan({
        installationId: installation.id,
        nonRescanProviders,
      });

    it("fingerprints every folder with the sources asked for", async () => {
      folders = [createFolder("Baganator"), createFolder("Syndicator")];

      const prepared = await prepare();

      expect(fingerprintRequests).to.deep.equal([
        { filePaths: ["AddOns/Baganator", "AddOns/Syndicator"], sources: ["wowup"] },
      ]);
      expect(prepared.addonFolders.map((af) => af.wowUpScanResults?.fingerprint)).to.deep.equal([
        "wowup:AddOns/Baganator",
        "wowup:AddOns/Syndicator",
      ]);
      expect(prepared.addonFolders[0].cfScanResults).to.equal(undefined);
    });

    it("flags folders that are git checkouts", async () => {
      folders = [createFolder("Baganator"), createFolder("MyDevAddon")];
      gitFolders = ["MyDevAddon"];

      const prepared = await prepare();

      expect(prepared.addonFolders.map((af) => af.ignoreReason)).to.deep.equal([undefined, "git_repo"]);
    });

    it("leaves out the folders of the saved addons of non-rescan providers", async () => {
      folders = [createFolder("Baganator"), createFolder("FromGitHub")];
      store.set("gh", createAddon({ id: "gh", providerName: "GitHub", installedFolderList: ["FromGitHub"] }));
      store.set("cf", createAddon({ id: "cf" }));

      const prepared = await prepare(["GitHub"]);

      expect(prepared.addonFolders.map((af) => af.name)).to.deep.equal(["Baganator"]);
    });

    it("lists the installation's addon folder with the user's symlink setting", async () => {
      scanSymlinks = true;

      await prepare();

      expect(listCalls).to.deep.equal([["AddOns", true]]);
    });

    it("fails for an installation main doesn't know", async () => {
      let error: Error | undefined;
      try {
        await service.prepareScan({ installationId: "nope" });
      } catch (e) {
        error = e as Error;
      }

      expect(error?.message).to.contain("nope");
    });

    it("scans every folder when not told which providers to keep", async () => {
      folders = [createFolder("FromGitHub")];
      store.set("gh", createAddon({ id: "gh", providerName: "GitHub", installedFolderList: ["FromGitHub"] }));

      const prepared = await prepare();

      expect(prepared.addonFolders.map((af) => af.name)).to.deep.equal(["FromGitHub"]);
    });

    it("only scans the folders asked for", async () => {
      folders = [createFolder("Baganator"), createFolder("Syndicator")];

      const prepared = await service.prepareScan({ installationId: installation.id, folderNames: ["Syndicator"] });

      expect(prepared.addonFolders.map((af) => af.name)).to.deep.equal(["Syndicator"]);
      expect(fingerprintRequests).to.deep.equal([{ filePaths: ["AddOns/Syndicator"], sources: ["wowup"] }]);
    });

    it("hands the folders of an addon the user linked back matched to it", async () => {
      folders = [createFolder("Baganator"), createFolder("Linked")];
      const linked = createAddon({
        id: "linked",
        externalId: "2002",
        installedFolderList: ["Linked"],
        isManuallyLinked: true,
      });
      store.set("linked", linked);
      store.set("cf", createAddon({ id: "cf" }));

      const prepared = await prepare([]);

      expect(prepared.addonFolders.map((af) => af.matchingAddon?.id)).to.deep.equal([undefined, "linked"]);
    });

    it("leaves a linked addon's folders to the providers when the scan doesn't save", async () => {
      folders = [createFolder("Linked")];
      store.set("linked", createAddon({ id: "linked", installedFolderList: ["Linked"], isManuallyLinked: true }));

      const prepared = await prepare();

      expect(prepared.addonFolders[0].matchingAddon).to.equal(undefined);
    });

    it("returns nothing when there are no addon folders", async () => {
      store.set("gh", createAddon({ id: "gh", providerName: "GitHub" }));

      const prepared = await prepare(["GitHub"]);

      expect(prepared).to.deep.equal({ addonFolders: [] });
      expect(fingerprintRequests).to.deep.equal([]);
    });
  });

  describe("completeScan", () => {
    const complete = (addonFolders: AddonFolder[], save: boolean, nonRescanProviders?: string[]) =>
      service.completeScan({
        installationId: installation.id,
        addonFolders,
        nonRescanProviders,
        providerNames: ["Curse", "WowInterface"],
        save,
      });

    it("makes one addon per match, keeping the folder with the most external ids", async () => {
      const matched = createAddon({ id: "m" });
      const main = createFolder("Baganator", { matchingAddon: matched });
      const sub = createFolder("Baganator_Options", { matchingAddon: matched });

      const addons = await complete([main, sub], false);

      expect(addons.map((a) => a.id)).to.deep.equal(["m"]);
    });

    it("collects the provider ids the toc names onto the matched addon", async () => {
      const matched = createAddon({ id: "m" });
      const folder = createFolder("Baganator", {
        matchingAddon: matched,
        tocs: [createToc("Baganator.toc", { wowInterfaceId: "2002", wagoAddonId: "abcdefgh" })],
      });

      await complete([folder], false);

      // Wago isn't one of this build's providers, so its id is left out
      expect(matched.externalIds).to.deep.equal([
        { id: "2002", providerName: "WowInterface" },
        { id: "1001", providerName: "Curse" },
      ]);
    });

    it("makes an ignored unknown addon for a folder nothing matched", async () => {
      const addons = await complete([createFolder("Mystery")], false);

      expect(addons).to.have.length(1);
      expect(addons[0]).to.include({
        id: "id-1",
        name: "Mystery",
        providerName: ADDON_PROVIDER_UNKNOWN,
        isIgnored: true,
        installationId: installation.id,
      });
      expect(addons[0].installedFolderList).to.deep.equal(["Mystery"]);
    });

    it("treats a load-on-demand folder of a matched addon as part of it", async () => {
      const matched = createFolder("Baganator", { matchingAddon: createAddon({ id: "m" }) });
      const lod = createFolder("Baganator_Bank", {
        tocs: [createToc("Baganator_Bank.toc", { loadOnDemand: "1", dependencyList: ["Baganator"] })],
      });

      const addons = await complete([matched, lod], false);

      expect(addons.map((a) => a.id)).to.deep.equal(["m"]);
    });

    it("puts every addon on the installation's channel and drops stale changelogs", async () => {
      store.set("gh", createAddon({ id: "gh", providerName: "GitHub", latestChangelog: "old" }));

      const addons = await complete([], false, ["GitHub"]);

      expect(addons[0].channelType).to.equal(AddonChannelType.Beta);
      expect(addons[0].latestChangelog).to.equal(undefined);
    });

    it("carries over the saved addons of non-rescan providers from main's own store", async () => {
      store.set("gh", createAddon({ id: "gh", providerName: "GitHub", installedFolderList: ["FromGitHub"] }));
      store.set("cf", createAddon({ id: "cf" }));

      await complete([createFolder("Baganator", { matchingAddon: createAddon({ id: "new" }) })], true, ["GitHub"]);

      expect([...store.keys()].sort()).to.deep.equal(["gh", "new"]);
    });

    it("keeps an addon the user linked across a rescan, until its folders are gone", async () => {
      folders = [createFolder("Linked")];
      store.set(
        "linked",
        createAddon({ id: "linked", externalId: "2002", installedFolderList: ["Linked"], isManuallyLinked: true }),
      );

      const prepared = await service.prepareScan({ installationId: installation.id, nonRescanProviders: [] });
      const kept = await complete(prepared.addonFolders, true, []);

      expect(kept.map((addon) => [addon.id, addon.isManuallyLinked])).to.deep.equal([["linked", true]]);
      expect(stored().map((addon) => addon.id)).to.deep.equal(["linked"]);

      folders = [];
      const gone = await complete(
        (await service.prepareScan({ installationId: installation.id, nonRescanProviders: [] })).addonFolders,
        true,
        [],
      );

      expect(gone).to.deep.equal([]);
    });

    it("only reads when not asked to save", async () => {
      store.set("old", createAddon({ id: "old" }));

      await complete([createFolder("Mystery")], false);

      expect([...store.keys()]).to.deep.equal(["old"]);
    });

    it("replaces the installation's saved addons when asked to save", async () => {
      store.set("old", createAddon({ id: "old" }));
      store.set("other", createAddon({ id: "other", installationId: "install-2" }));

      await complete([createFolder("Baganator", { matchingAddon: createAddon({ id: "new" }) })], true);

      expect([...store.keys()].sort()).to.deep.equal(["new", "other"]);
    });

    it("keeps the user's settings across a rescan", async () => {
      store.set(
        "old",
        createAddon({ id: "old", isIgnored: true, autoUpdateEnabled: true, channelType: AddonChannelType.Alpha }),
      );

      await complete([createFolder("Baganator", { matchingAddon: createAddon({ id: "new" }) })], true);

      expect(stored()).to.have.length(1);
      expect(stored()[0]).to.include({
        id: "new",
        isIgnored: true,
        autoUpdateEnabled: true,
        channelType: AddonChannelType.Alpha,
      });
    });

    it("fails for an installation main doesn't know", async () => {
      let error: Error | undefined;
      try {
        await service.completeScan({
          installationId: "nope",
          addonFolders: [],
          providerNames: [],
          save: true,
        });
      } catch (e) {
        error = e as Error;
      }

      expect(error?.message).to.contain("nope");
    });
  });

  describe("applySync", () => {
    const missing = (addonId: string) => ({ addonId, warningType: AddonWarningType.MissingOnProvider });

    it("saves the addons the sync changed", () => {
      store.set("a", createAddon({ id: "a" }));

      service.applySync({
        providerName: "Curse",
        addons: [createAddon({ id: "a" })],
        searchResults: [],
        failures: [missing("1001")],
      });

      expect((store.get("a") as Addon).warningType).to.equal(AddonWarningType.MissingOnProvider);
    });

    it("applies the answer to the saved copy, not the caller's older one", () => {
      store.set("a", createAddon({ id: "a", installedVersion: "2.0.0" }));
      const stale = createAddon({ id: "a", installedVersion: "1.0.0" });

      const applied = service.applySync({
        providerName: "Curse",
        addons: [stale],
        searchResults: [],
        failures: [missing("1001")],
      });

      expect(store.get("a")).to.include({ installedVersion: "2.0.0", warningType: AddonWarningType.MissingOnProvider });
      expect(applied.addons[0]).to.include({ installedVersion: "2.0.0" });
    });

    it("updates an addon that isn't saved yet without saving it", () => {
      const installing = createAddon({ id: "new" });

      const applied = service.applySync({
        providerName: "Curse",
        addons: [installing],
        searchResults: [],
        failures: [missing("1001")],
      });

      expect(store.has("new")).to.equal(false);
      expect(applied.addons[0]).to.include({ id: "new", warningType: AddonWarningType.MissingOnProvider });
    });
  });
});
