import { expect } from "chai";
import * as Store from "electron-store";
import {
  Addon,
  AddonChannelType,
  AddonProvider,
  AddonFolder,
  AddonWarningType,
  Toc,
  WowClientType,
  WowInstallation,
} from "wowup-lib-core";

import { ADDON_PROVIDER_UNKNOWN } from "../../../src/common/constants";
import { AddonScanEvent, AddonScanRequest, FolderScanResults } from "../../../src/common/models/addon-scan";
import { ProviderLookup } from "../addon-providers/addon-provider-registry";
import { AddonRepository } from "./addon-repository";
import { AddonSyncDeps, AddonSyncService } from "./addon-sync.service";

const silentLog = { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined };

/** A provider that matches the folders named in `matches`, recording the folders it was offered */
interface FakeProvider {
  name: string;
  enabled?: boolean;
  allowReScan?: boolean;
  matches?: Record<string, Addon>;
  error?: Error;
  offered: string[][];
}

function fakeProvider(name: string, options: Partial<FakeProvider> = {}): FakeProvider {
  return { name, enabled: true, allowReScan: true, offered: [], ...options };
}

function lookupOf(providers: FakeProvider[]): ProviderLookup {
  const asProvider = (fake: FakeProvider) =>
    ({
      name: fake.name,
      allowReScan: fake.allowReScan,
      scan: (_installation: WowInstallation, _channel: AddonChannelType, addonFolders: AddonFolder[]) => {
        fake.offered.push(addonFolders.map((af) => af.name));
        if (fake.error) {
          return Promise.reject(fake.error);
        }
        for (const folder of addonFolders) {
          const match = fake.matches?.[folder.name];
          if (match) {
            folder.matchingAddon = match;
          }
        }
        return Promise.resolve();
      },
    }) as unknown as AddonProvider;

  return {
    getProvider: (name) => {
      const fake = providers.find((p) => p.name === name);
      return fake ? asProvider(fake) : undefined;
    },
    getEnabledProviders: () => providers.filter((p) => p.enabled !== false).map(asProvider),
    isEnabled: (name) => providers.some((p) => p.name === name && p.enabled !== false),
    getProviderNames: () => providers.map((p) => p.name),
    getNonRescanProviderNames: () => providers.filter((p) => p.allowReScan !== true).map((p) => p.name),
  };
}

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
  let listGate: Promise<void> | undefined;
  let providers: FakeProvider[];
  let lookup: ProviderLookup | undefined;
  let events: AddonScanEvent[];

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
    listGate = undefined;
    // The build's providers, whose names decide which toc ids are kept; a scan can't find GitHub addons
    providers = [fakeProvider("Curse"), fakeProvider("WowInterface"), fakeProvider("GitHub", { allowReScan: false })];
    lookup = lookupOf(providers);
    events = [];

    const deps: AddonSyncDeps = {
      repository: new AddonRepository(store as unknown as Store),
      getInstallations: () => [installation],
      getAddonFolderPath: () => "AddOns",
      listAddons: async (addonFolderPath, scanSymlinks) => {
        listCalls.push([addonFolderPath, scanSymlinks]);
        await listGate;
        return folders;
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
      getProviders: () => lookup,
      onScanEvent: (event) => events.push(event),
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

    it("returns nothing when there are no addon folders", async () => {
      store.set("gh", createAddon({ id: "gh", providerName: "GitHub" }));

      const prepared = await prepare(["GitHub"]);

      expect(prepared).to.deep.equal({ addonFolders: [] });
      expect(fingerprintRequests).to.deep.equal([]);
    });
  });

  describe("scan", () => {
    /** Folders arrive already matched, which the providers leave alone */
    const complete = (addonFolders: AddonFolder[], save: boolean) => {
      folders = addonFolders;
      return service.scan({ installationId: installation.id, save });
    };
    const useProviders = (fakes: FakeProvider[]) => {
      providers = fakes;
      lookup = lookupOf(fakes);
    };

    it("lets each enabled provider match, in order, only what no provider before it claimed", async () => {
      const curse = fakeProvider("Curse", { matches: { Baganator: createAddon({ id: "cf" }) } });
      const off = fakeProvider("Off", { enabled: false });
      const wowi = fakeProvider("WowInterface", {
        matches: {
          Syndicator: createAddon({
            id: "wowi",
            name: "Syndicator",
            providerName: "WowInterface",
            externalId: "2002",
            installedFolderList: ["Syndicator"],
          }),
        },
      });
      useProviders([curse, off, wowi]);
      folders = [
        createFolder("Baganator"),
        createFolder("Syndicator"),
        createFolder("NoToc", { tocs: [] }),
        createFolder("Dev"),
      ];
      gitFolders = ["Dev"];

      const addons = await service.scan({ installationId: installation.id, save: false });

      expect(curse.offered).to.deep.equal([["Baganator", "Syndicator"]]);
      expect(off.offered).to.deep.equal([]);
      expect(wowi.offered).to.deep.equal([["Syndicator"]]);
      expect(addons.map((a) => a.id)).to.include.members(["cf", "wowi"]);
    });

    it("reports a failing provider and still lets the next one match", async () => {
      const broken = fakeProvider("Curse", { error: new Error("down") });
      const wowi = fakeProvider("WowInterface", { matches: { Baganator: createAddon({ id: "wowi" }) } });
      useProviders([broken, wowi]);
      folders = [createFolder("Baganator")];

      const addons = await service.scan({ installationId: installation.id, save: false });

      expect(addons.map((a) => a.id)).to.deep.equal(["wowi"]);
      expect(events.map((e) => e.type)).to.deep.equal(["start", "folders", "providerError", "complete"]);
      expect(events[2]).to.deep.include({ providerName: "Curse", installationId: installation.id });
      expect((events[2] as { error: { message: string } }).error.message).to.equal("down");
    });

    it("reports the folder count", async () => {
      folders = [createFolder("Baganator"), createFolder("Syndicator")];

      await service.scan({ installationId: installation.id, save: false });

      expect(events[1]).to.deep.equal({ installationId: installation.id, type: "folders", totalCount: 2 });
    });

    it("reports the end of a scan that fails", async () => {
      listGate = Promise.reject(new Error("disk gone"));
      listGate.catch(() => undefined);

      let error: Error | undefined;
      await service.scan({ installationId: installation.id, save: true }).catch((e: Error) => (error = e));

      expect(error?.message).to.equal("disk gone");
      expect(events.map((e) => e.type)).to.deep.equal(["start", "complete"]);
    });

    it("fails before the providers are initialized", async () => {
      lookup = undefined;

      let error: Error | undefined;
      await service.scan({ installationId: installation.id, save: false }).catch((e: Error) => (error = e));

      expect(error?.message).to.contain("not initialized");
    });

    it("runs one saving scan at a time, and callers that ask meanwhile share the next one (#1561)", async () => {
      let open!: () => void;
      listGate = new Promise((resolve) => (open = resolve));

      const first = service.scan({ installationId: installation.id, save: true });
      const second = service.scan({ installationId: installation.id, save: true });
      const third = service.scan({ installationId: installation.id, save: true });
      const joined = service.scan({ installationId: installation.id, save: true, joinRunning: true });
      await Promise.resolve();
      expect(listCalls).to.have.length(1);

      open();
      await Promise.all([first, second, third, joined]);

      expect(listCalls).to.have.length(2);
      expect(second).to.equal(third);
      expect(joined).to.equal(first);
    });

    it("lets a read-only scan run beside a saving one", async () => {
      let open!: () => void;
      listGate = new Promise((resolve) => (open = resolve));

      const saving = service.scan({ installationId: installation.id, save: true });
      const reading = service.scan({ installationId: installation.id, save: false });
      await Promise.resolve();
      expect(listCalls).to.have.length(2);

      open();
      await Promise.all([saving, reading]);
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

      const addons = await complete([], true);

      expect(addons[0].channelType).to.equal(AddonChannelType.Beta);
      expect(addons[0].latestChangelog).to.equal(undefined);
    });

    it("carries over the saved addons of non-rescan providers from main's own store", async () => {
      store.set("gh", createAddon({ id: "gh", providerName: "GitHub", installedFolderList: ["FromGitHub"] }));
      store.set("cf", createAddon({ id: "cf" }));

      await complete([createFolder("Baganator", { matchingAddon: createAddon({ id: "new" }) })], true);

      expect([...store.keys()].sort()).to.deep.equal(["gh", "new"]);
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
        await service.scan({ installationId: "nope", save: true });
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
