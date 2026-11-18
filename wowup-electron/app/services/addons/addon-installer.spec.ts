import * as path from "path";
import { expect } from "chai";
import {
  Addon,
  AddonChannelType,
  AddonProvider,
  AddonSearchResult,
  GetAllResult,
  WowClientType,
  WowInstallation,
} from "wowup-lib-core";

import { ADDON_PROVIDER_HUB } from "../../../src/common/constants";
import {
  AddExternalIdRequest,
  AddonInstallPhase,
  InstallAddonFileRequest,
  InstalledAddonFile,
} from "../../../src/common/models/addon-install";
import { ApplyAddonSyncRequest } from "../../../src/common/models/addon-scan";
import { ProviderLookup } from "../addon-providers/addon-provider-registry";
import { WowUpAddonProvider } from "../addon-providers/wowup-addon-provider";
import { AddonInstaller, AddonInstallerDeps, InstallerDownloadOptions } from "./addon-installer";

const silentLog = { info: () => undefined, error: () => undefined };

const installation = {
  id: "install-1",
  clientType: WowClientType.Retail,
  displayName: "Retail",
  defaultAddonChannelType: AddonChannelType.Stable,
} as WowInstallation;

function createAddon(overrides: Partial<Addon> = {}): Addon {
  return {
    id: "addon-1",
    name: "Bagan ator",
    providerName: "Curse",
    externalId: "1001",
    installationId: installation.id,
    downloadUrl: "https://cdn.test/v1.zip",
    installedFolderList: ["Baganator"],
    ...overrides,
  } as Addon;
}

interface Setup {
  /** Downloads that fail before one works */
  failingDownloads?: number;
  /** What a re-sync returns for the addon */
  resyncUrl?: string;
  hubIds?: Map<string, string>;
  hubEnabled?: boolean;
  hubFails?: boolean;
  installFails?: boolean;
}

function createInstaller(setup: Setup = {}) {
  const downloads: InstallerDownloadOptions[] = [];
  const delays: number[] = [];
  const removed: string[] = [];
  const installRequests: InstallAddonFileRequest[] = [];
  const syncRequests: ApplyAddonSyncRequest[] = [];
  const externalIds: AddExternalIdRequest[] = [];
  let failuresLeft = setup.failingDownloads ?? 0;

  const curse = {
    name: "Curse",
    forceIgnore: false,
    getDownloadAuth: () => Promise.resolve({ headers: { "X-Api-Key": "key" } }),
    getAll: (_installation: WowInstallation, ids: string[]): Promise<GetAllResult> =>
      Promise.resolve({
        searchResults: [{ externalId: ids[0], downloadUrl: setup.resyncUrl } as unknown as AddonSearchResult],
        errors: [],
      }),
  } as unknown as AddonProvider;

  const hub = Object.create(WowUpAddonProvider.prototype) as WowUpAddonProvider;
  hub.getAddonIdsByFingerprints = (fingerprints: string[]) =>
    setup.hubFails
      ? Promise.reject(new Error("hub down"))
      : Promise.resolve(setup.hubIds ?? new Map(fingerprints.map((fp) => [fp, `hub-${fp}`])));

  const byName = new Map<string, AddonProvider>([
    ["Curse", curse],
    [ADDON_PROVIDER_HUB, hub as unknown as AddonProvider],
  ]);
  const providers: ProviderLookup = {
    getProvider: (name) => byName.get(name),
    getEnabledProviders: () => [...byName.values()],
    isEnabled: (name) => (name === ADDON_PROVIDER_HUB ? setup.hubEnabled !== false : byName.has(name)),
    getProviderNames: () => [...byName.keys()],
    getNonRescanProviderNames: () => [],
  };

  const deps: AddonInstallerDeps = {
    getProviders: () => providers,
    installService: {
      installFile: (request: InstallAddonFileRequest, onPhase?: (phase: AddonInstallPhase) => void) => {
        installRequests.push(request);
        if (setup.installFails) {
          return Promise.reject(new Error("unzip failed"));
        }
        onPhase?.("backingUp");
        onPhase?.("installing");
        const installed: InstalledAddonFile = { addon: { ...request.addon }, removedAddons: [] };
        return Promise.resolve(installed);
      },
      addExternalId: (request: AddExternalIdRequest) => {
        externalIds.push(request);
        return [{ providerName: request.providerName, id: request.externalId }];
      },
    },
    applySync: (request) => {
      syncRequests.push(request);
      const url = (request.searchResults[0] as { downloadUrl?: string } | undefined)?.downloadUrl;
      return {
        addons: request.addons.map((a) => (url ? { ...a, downloadUrl: url } : a)),
        failureAddonNames: [],
        noFileAddons: [],
      };
    },
    download: (options) => {
      downloads.push(options);
      if (failuresLeft > 0) {
        failuresLeft--;
        return Promise.reject(new Error("net::ERR_FAILED"));
      }
      return Promise.resolve(`downloads/x-${options.fileName}`);
    },
    getInstallations: () => [installation],
    getAddonFolderPath: () => "AddOns",
    getFingerprints: (request) =>
      Promise.resolve(request.filePaths.map((path) => ({ path, wowup: { fingerprint: `fp:${path}` } as never }))),
    downloadsFolderPath: "downloads",
    removeFile: (filePath) => {
      removed.push(filePath);
      return Promise.resolve();
    },
    delay: (ms) => {
      delays.push(ms);
      return Promise.resolve();
    },
    log: silentLog,
  };

  return {
    installer: new AddonInstaller(deps),
    deps,
    downloads,
    delays,
    removed,
    installRequests,
    syncRequests,
    externalIds,
  };
}

async function rejectionOf(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (e) {
    return e as Error;
  }
  throw new Error("expected a rejection");
}

describe("AddonInstaller", () => {
  it("downloads with the provider's auth and installs the zip", async () => {
    const { installer, downloads, installRequests, removed } = createInstaller();
    const phases: AddonInstallPhase[] = [];

    const installed = await installer.installAddon({ addon: createAddon() }, (phase) => phases.push(phase));

    expect(downloads).to.deep.equal([
      {
        url: "https://cdn.test/v1.zip",
        fileName: "bagan-ator.zip",
        outputFolder: "downloads",
        auth: { headers: { "X-Api-Key": "key" } },
      },
    ]);
    expect(installRequests[0]).to.deep.include({ zipFilePath: "downloads/x-bagan-ator.zip", forceIgnore: false });
    expect(installRequests[0].providerNames).to.deep.equal(["Curse", ADDON_PROVIDER_HUB]);
    expect(phases).to.deep.equal(["downloading", "backingUp", "installing"]);
    expect(removed).to.deep.equal(["downloads/x-bagan-ator.zip"]);
    expect(installed.addon.id).to.equal("addon-1");
  });

  it("re-syncs the addon before each retry, so a fresh download url is used", async () => {
    const { installer, downloads, delays, syncRequests } = createInstaller({
      failingDownloads: 2,
      resyncUrl: "https://cdn.test/fresh.zip",
    });
    const phases: AddonInstallPhase[] = [];

    await installer.installAddon({ addon: createAddon() }, (phase) => phases.push(phase));

    expect(downloads.map((d) => d.url)).to.deep.equal([
      "https://cdn.test/v1.zip",
      "https://cdn.test/fresh.zip",
      "https://cdn.test/fresh.zip",
    ]);
    expect(syncRequests).to.have.length(2);
    expect(syncRequests[0]).to.deep.include({ providerName: "Curse" });
    expect(delays).to.deep.equal([2000, 3000]);
    expect(phases.filter((p) => p === "retry")).to.have.length(2);
  });

  it("gives up after three retries", async () => {
    const { installer, downloads, installRequests } = createInstaller({ failingDownloads: 10 });

    const error = await rejectionOf(installer.installAddon({ addon: createAddon() }));

    expect(error.message).to.equal("net::ERR_FAILED");
    expect(downloads).to.have.length(4);
    expect(installRequests).to.have.length(0);
  });

  it("leaves the caller's addon alone", async () => {
    const { installer } = createInstaller({ failingDownloads: 1, resyncUrl: "https://cdn.test/fresh.zip" });
    const addon = createAddon();

    await installer.installAddon({ addon });

    expect(addon.downloadUrl).to.equal("https://cdn.test/v1.zip");
  });

  it("deletes the zip when the install fails", async () => {
    const { installer, removed } = createInstaller({ installFails: true });

    const error = await rejectionOf(installer.installAddon({ addon: createAddon() }));

    expect(error.message).to.equal("unzip failed");
    expect(removed).to.deep.equal(["downloads/x-bagan-ator.zip"]);
  });

  it("fails for a provider or an installation it doesn't know", async () => {
    const { installer } = createInstaller();

    expect(
      (await rejectionOf(installer.installAddon({ addon: createAddon({ providerName: "Nope" }) }))).message,
    ).to.contain("Nope");
    expect(
      (await rejectionOf(installer.installAddon({ addon: createAddon({ installationId: "gone" }) }))).message,
    ).to.contain("gone");
  });

  describe("hub id", () => {
    it("saves the hub id the installed folders' fingerprints match", async () => {
      const { installer, externalIds } = createInstaller();

      const installed = await installer.installAddon({ addon: createAddon() });

      expect(externalIds).to.deep.equal([
        {
          addonId: "addon-1",
          providerName: ADDON_PROVIDER_HUB,
          externalId: `hub-fp:${path.join("AddOns", "Baganator")}`,
        },
      ]);
      expect(installed.addon.externalIds?.[0].providerName).to.equal(ADDON_PROVIDER_HUB);
    });

    it("skips the lookup when the hub is off or the addon already has a hub id", async () => {
      const off = createInstaller({ hubEnabled: false });
      await off.installer.installAddon({ addon: createAddon() });
      expect(off.externalIds).to.deep.equal([]);

      const known = createInstaller();
      await known.installer.installAddon({
        addon: createAddon({ externalIds: [{ providerName: ADDON_PROVIDER_HUB, id: "h" }] }),
      });
      expect(known.externalIds).to.deep.equal([]);
    });

    it("never fails the install over a hub failure", async () => {
      const { installer, externalIds } = createInstaller({ hubFails: true });

      const installed = await installer.installAddon({ addon: createAddon() });

      expect(installed.addon.id).to.equal("addon-1");
      expect(externalIds).to.deep.equal([]);
    });
  });
});
