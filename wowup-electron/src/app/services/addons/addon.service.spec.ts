/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-argument */
import { join as pathJoin } from "path";
import { Subject } from "rxjs";
import {
  Addon,
  AddonChannelType,
  AddonDependencyType,
  AddonProvider,
  AddonSearchResult,
  AddonSearchResultFile,
  WowClientType,
  WowInstallation,
} from "wowup-lib-core";

import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { AnalyticsService } from "../analytics/analytics.service";
import { FileService } from "../files/file.service";
import { AddonStorageService } from "../storage/addon-storage.service";
import { TocService } from "../toc/toc.service";
import { WarcraftInstallationService } from "../warcraft/warcraft-installation.service";
import { WarcraftService } from "../warcraft/warcraft.service";
import { WowUpService } from "../wowup/wowup.service";
import { AddonFingerprintService } from "./addon-fingerprint.service";
import { AddonInstallService, InstallQueueItem } from "./addon-install.service";
import { AddonService } from "./addon.service";
import { AddonProviderFactory } from "./addon.provider.factory";

const ADDON_FOLDER_PATH = pathJoin("wow", "_retail_", "Interface", "AddOns");

describe("AddonService", () => {
  let installation: WowInstallation;
  let provider: jasmine.SpyObj<AddonProvider>;

  let addonStorage: jasmine.SpyObj<AddonStorageService>;
  let addonInstallService: jasmine.SpyObj<AddonInstallService>;
  let analyticsService: jasmine.SpyObj<AnalyticsService>;
  let warcraftService: jasmine.SpyObj<WarcraftService>;
  let fileService: jasmine.SpyObj<FileService>;
  let warcraftInstallationService: jasmine.SpyObj<WarcraftInstallationService>;
  let addonProviderFactory: jasmine.SpyObj<AddonProviderFactory>;

  /** Addons saved to storage, as getAllForInstallationIdAsync returns them. */
  let installed: Addon[];
  /** Every item handed to the install queue, in order. */
  let enqueued: InstallQueueItem[];
  /** When false, enqueued items are left pending so a test can settle them itself. */
  let autoComplete: boolean;

  let service: AddonService;

  function createFile(overrides: Partial<AddonSearchResultFile> = {}): AddonSearchResultFile {
    return {
      externalId: "5001",
      channelType: AddonChannelType.Stable,
      version: "1.2.0",
      folders: ["Baganator"],
      gameVersion: "110200",
      downloadUrl: "https://example.test/baganator.zip",
      releaseDate: new Date("2026-09-01"),
      dependencies: [],
      ...overrides,
    };
  }

  function createSearchResult(overrides: Partial<AddonSearchResult> = {}): AddonSearchResult {
    return {
      externalId: "1001",
      name: "Baganator",
      author: "plusmouse",
      thumbnailUrl: "",
      externalUrl: "https://example.test/baganator",
      providerName: "Curse",
      downloadCount: 100,
      files: [createFile()],
      ...overrides,
    } as AddonSearchResult;
  }

  function createAddon(overrides: Partial<Addon> = {}): Addon {
    return {
      id: "addon-1",
      name: "Baganator",
      providerName: "Curse",
      externalId: "1001",
      latestVersion: "1.2.0",
      downloadUrl: "https://example.test/baganator.zip",
      clientType: WowClientType.Retail,
      channelType: AddonChannelType.Stable,
      installationId: installation.id,
      installedFolderList: [],
      isIgnored: false,
      autoUpdateEnabled: false,
      autoUpdateNotificationsEnabled: false,
      screenshotUrls: [],
      ...overrides,
    } as Addon;
  }

  beforeEach(() => {
    installation = {
      id: "install-1",
      clientType: WowClientType.Retail,
      location: pathJoin("wow", "_retail_", "Wow.exe"),
      label: "Retail",
      displayName: "Retail",
      selected: true,
      defaultAddonChannelType: AddonChannelType.Stable,
      defaultAutoUpdate: true,
    };

    provider = jasmine.createSpyObj<AddonProvider>("AddonProvider", ["getById", "getAll", "isValidAddonId"]);
    provider.isValidAddonId.and.returnValue(true);

    addonStorage = jasmine.createSpyObj<AddonStorageService>("AddonStorageService", [
      "setAsync",
      "removeAsync",
      "getByExternalIdAsync",
      "getAvailableForUpdate",
      "getAllForInstallationIdAsync",
    ]);
    installed = [];
    addonStorage.setAsync.and.callFake((_key, value) => {
      installed = [...installed.filter((a) => a.id !== value.id), value];
      return Promise.resolve();
    });
    addonStorage.getAllForInstallationIdAsync.and.callFake((id) =>
      Promise.resolve(installed.filter((a) => a.installationId === id)),
    );
    addonStorage.removeAsync.and.resolveTo();
    addonStorage.getByExternalIdAsync.and.resolveTo(undefined);
    addonStorage.getAvailableForUpdate.and.resolveTo([]);

    enqueued = [];
    autoComplete = true;
    addonInstallService = jasmine.createSpyObj<AddonInstallService>("AddonInstallService", ["enqueue"], {
      addonInstalled$: new Subject<AddonUpdateEvent>().asObservable(),
      installError$: new Subject<Error>().asObservable(),
    });
    addonInstallService.enqueue.and.callFake((item) => {
      enqueued.push(item);
      if (autoComplete) {
        item.completion.resolve();
      }
    });

    analyticsService = jasmine.createSpyObj<AnalyticsService>("AnalyticsService", ["trackAction"]);

    warcraftService = jasmine.createSpyObj<WarcraftService>("WarcraftService", ["getAddonFolderPath"]);
    warcraftService.getAddonFolderPath.and.returnValue(ADDON_FOLDER_PATH);

    fileService = jasmine.createSpyObj<FileService>("FileService", ["deleteIfExists"]);
    fileService.deleteIfExists.and.resolveTo();

    warcraftInstallationService = jasmine.createSpyObj<WarcraftInstallationService>(
      "WarcraftInstallationService",
      ["getWowInstallation"],
      {
        wowInstallations$: new Subject<WowInstallation[]>().asObservable(),
        legacyInstallationSrc$: new Subject<WowInstallation[]>().asObservable(),
      },
    );
    warcraftInstallationService.getWowInstallation.and.callFake((id) =>
      id === installation.id ? installation : undefined,
    );

    addonProviderFactory = jasmine.createSpyObj<AddonProviderFactory>("AddonProviderFactory", ["getProvider"]);
    addonProviderFactory.getProvider.and.callFake(((name: string) => (name === "Curse" ? provider : undefined)) as any);

    service = new AddonService(
      addonStorage,
      addonInstallService,
      analyticsService,
      warcraftService,
      {} as WowUpService,
      fileService,
      {} as TocService,
      warcraftInstallationService,
      addonProviderFactory,
      {} as AddonFingerprintService,
    );
  });

  describe("getRequiredDependencies", () => {
    it("should return only required dependencies", () => {
      const addon = createAddon({
        dependencies: [
          { externalAddonId: "1", type: AddonDependencyType.Required },
          { externalAddonId: "2", type: AddonDependencyType.Optional },
          { externalAddonId: "3", type: AddonDependencyType.Embedded },
          { externalAddonId: "4", type: AddonDependencyType.Other },
          { externalAddonId: "5", type: AddonDependencyType.Required },
        ],
      });

      expect(service.getRequiredDependencies(addon).map((d) => d.externalAddonId)).toEqual(["1", "5"]);
    });

    it("should return an empty list when the addon has no dependencies", () => {
      expect(service.getRequiredDependencies(createAddon({ dependencies: undefined }))).toEqual([]);
    });
  });

  describe("installOrUpdateAddon", () => {
    it("should enqueue the addon with its install type and resolve when the queue completes it", async () => {
      autoComplete = false;
      const addon = createAddon();
      let settled = false;

      const promise = service.installOrUpdateAddon(addon, "update").then(() => (settled = true));
      await Promise.resolve();

      expect(enqueued.length).toEqual(1);
      expect(enqueued[0].addon).toBe(addon);
      expect(enqueued[0].installType).toEqual("update");
      expect(settled).toBeFalse();

      enqueued[0].completion.resolve();
      await promise;
      expect(settled).toBeTrue();
    });

    it("should reject when the queue rejects the item", async () => {
      autoComplete = false;
      const promise = service.installOrUpdateAddon(createAddon(), "install");

      enqueued[0].completion.reject(new Error("boom"));

      await expectAsync(promise).toBeRejectedWithError("boom");
    });

    it("should report pending and then forward queue progress to the caller", async () => {
      const onUpdate = jasmine.createSpy("onUpdate");

      await service.installOrUpdateAddon(createAddon(), "install", onUpdate);
      await enqueued[0].onUpdate(AddonInstallState.Installing, 75);

      expect(onUpdate.calls.allArgs()).toEqual([
        [AddonInstallState.Pending, 0],
        [AddonInstallState.Installing, 75],
      ]);
    });

    it("should snapshot the original addon", async () => {
      const original = createAddon({ id: "old" });

      await service.installOrUpdateAddon(createAddon(), "update", undefined, original);

      expect(enqueued[0].originalAddon).toEqual(original);
      expect(enqueued[0].originalAddon).not.toBe(original);
    });

    it("should throw when the addon has no download url", async () => {
      await expectAsync(service.installOrUpdateAddon(createAddon({ downloadUrl: "" }), "install")).toBeRejected();
      expect(enqueued.length).toEqual(0);
    });

    it("should throw when the installation is missing", async () => {
      await expectAsync(
        service.installOrUpdateAddon(createAddon({ installationId: "missing" }), "install"),
      ).toBeRejectedWithError(/installation not found/);
      expect(enqueued.length).toEqual(0);
    });

    it("should throw when the provider is missing", async () => {
      await expectAsync(
        service.installOrUpdateAddon(createAddon({ providerName: "Nope" }), "install"),
      ).toBeRejectedWithError(/Provider not found/);
      expect(enqueued.length).toEqual(0);
    });
  });

  describe("installAddon", () => {
    it("should enqueue an install and save the addon afterwards", async () => {
      const addon = createAddon();

      await service.installAddon(addon);

      expect(enqueued[0].installType).toEqual("install");
      expect(addonStorage.setAsync).toHaveBeenCalledWith(addon.id, addon);
    });
  });

  describe("updateAddon", () => {
    it("should enqueue an update", async () => {
      await service.updateAddon(createAddon());

      expect(enqueued[0].installType).toEqual("update");
    });
  });

  describe("getAddon", () => {
    it("should build an addon from the provider result and its latest file", async () => {
      const file = createFile({
        dependencies: [
          { externalAddonId: "2002", type: AddonDependencyType.Required },
          { externalAddonId: "3003", type: AddonDependencyType.Optional },
        ],
      });
      provider.getById.and.resolveTo(createSearchResult({ files: [file] }));

      const addon = await service.getAddon("1001", "Curse", installation).toPromise();

      expect(provider.getById).toHaveBeenCalledWith("1001", installation);
      expect(addon).toEqual(
        jasmine.objectContaining({
          name: "Baganator",
          externalId: "1001",
          providerName: "Curse",
          latestVersion: "1.2.0",
          downloadUrl: file.downloadUrl,
          externalLatestReleaseId: "5001",
          installationId: installation.id,
          clientType: WowClientType.Retail,
          autoUpdateEnabled: true,
          dependencies: [
            { externalAddonId: "2002", type: AddonDependencyType.Required },
            { externalAddonId: "3003", type: AddonDependencyType.Optional },
          ],
        }),
      );
      expect(addon?.id).toEqual(jasmine.any(String));
    });

    it("should pick the newest file in the installation's channel", async () => {
      provider.getById.and.resolveTo(
        createSearchResult({
          files: [
            createFile({ version: "1.0.0", releaseDate: new Date("2026-01-01") }),
            createFile({
              version: "1.3.0-beta",
              channelType: AddonChannelType.Beta,
              releaseDate: new Date("2026-10-01"),
            }),
            createFile({ version: "1.2.0", releaseDate: new Date("2026-09-01") }),
          ],
        }),
      );

      const addon = await service.getAddon("1001", "Curse", installation).toPromise();

      expect(addon?.latestVersion).toEqual("1.2.0");
    });

    it("should return undefined when the provider finds nothing", async () => {
      provider.getById.and.resolveTo(undefined);

      const addon = await service.getAddon("1001", "Curse", installation).toPromise();

      expect(addon).toBeUndefined();
    });

    it("should throw when the provider is missing", () => {
      expect(() => service.getAddon("1001", "Nope", installation)).toThrowError(/Provider not found/);
    });
  });

  describe("installPotentialAddon", () => {
    it("should install the latest file and carry its dependencies onto the addon", async () => {
      const searchResult = createSearchResult({
        files: [
          createFile({
            dependencies: [
              { externalAddonId: "2002", type: AddonDependencyType.Required },
              { externalAddonId: "3003", type: AddonDependencyType.Embedded },
            ],
          }),
        ],
      });

      await service.installPotentialAddon(searchResult, installation);

      expect(enqueued.length).toEqual(1);
      expect(enqueued[0].installType).toEqual("install");
      expect(enqueued[0].addon.externalId).toEqual("1001");
      expect(enqueued[0].addon.dependencies).toEqual([
        { externalAddonId: "2002", type: AddonDependencyType.Required },
        { externalAddonId: "3003", type: AddonDependencyType.Embedded },
      ]);
    });

    it("should install the requested file instead of the latest one", async () => {
      const target = createFile({ version: "0.9.0", downloadUrl: "https://example.test/old.zip" });

      await service.installPotentialAddon(createSearchResult(), installation, undefined, target);

      expect(enqueued[0].addon.latestVersion).toEqual("0.9.0");
      expect(enqueued[0].addon.downloadUrl).toEqual("https://example.test/old.zip");
    });

    it("should throw when the addon is already installed", async () => {
      addonStorage.getByExternalIdAsync.and.resolveTo(createAddon());

      await expectAsync(service.installPotentialAddon(createSearchResult(), installation)).toBeRejectedWithError(
        "Addon already installed",
      );
      expect(addonStorage.getByExternalIdAsync).toHaveBeenCalledWith("1001", "Curse", installation.id);
      expect(enqueued.length).toEqual(0);
    });

    it("should do nothing when the search result has no files", async () => {
      await service.installPotentialAddon(createSearchResult({ files: undefined }), installation);

      expect(enqueued.length).toEqual(0);
    });
  });

  describe("installBaseAddon", () => {
    it("should look the addon up, save it and install it", async () => {
      provider.getById.and.resolveTo(createSearchResult());

      const addon = await service.installBaseAddon("1001", "Curse", installation);

      expect(addon?.externalId).toEqual("1001");
      expect(addonStorage.setAsync).toHaveBeenCalledWith(addon?.id, addon);
      expect(enqueued.length).toEqual(1);
      expect(enqueued[0].addon).toBe(addon);
    });

    it("should return undefined when the provider finds nothing", async () => {
      provider.getById.and.resolveTo(undefined);

      const addon = await service.installBaseAddon("1001", "Curse", installation);

      expect(addon).toBeUndefined();
      expect(enqueued.length).toEqual(0);
    });

    it("should throw when the addon is already installed", async () => {
      addonStorage.getByExternalIdAsync.and.resolveTo(createAddon());

      await expectAsync(service.installBaseAddon("1001", "Curse", installation)).toBeRejectedWithError(
        "Addon already installed",
      );
      expect(provider.getById).not.toHaveBeenCalled();
    });
  });

  describe("installDependencies", () => {
    /** Search results the mocked provider returns, keyed by external id. */
    let catalog: Record<string, AddonSearchResult>;

    /** Adds an addon to the provider's catalog, with one stable file holding the given required deps. */
    function publish(externalId: string, requires: string[] = [], folders = [`Addon${externalId}`]) {
      catalog[externalId] = createSearchResult({
        externalId,
        name: `Addon ${externalId}`,
        files: [
          createFile({
            folders,
            downloadUrl: `https://example.test/${externalId}.zip`,
            dependencies: requires.map((id) => ({ externalAddonId: id, type: AddonDependencyType.Required })),
          }),
        ],
      });
    }

    function requiring(...externalIds: string[]): Partial<Addon> {
      return {
        dependencies: externalIds.map((id) => ({ externalAddonId: id, type: AddonDependencyType.Required })),
      };
    }

    function enqueuedIds(): Array<string | undefined> {
      return enqueued.map((item) => item.addon.externalId);
    }

    beforeEach(() => {
      catalog = {};
      provider.getById.and.callFake((externalId) => Promise.resolve(catalog[externalId]));
      publish("2002");
      publish("3003");
    });

    it("should install each missing required dependency", async () => {
      await service.installDependencies(createAddon(requiring("2002", "3003")));

      expect(enqueuedIds()).toEqual(["2002", "3003"]);
      expect(enqueued.every((item) => item.installType === "install")).toBeTrue();
      expect(enqueued.every((item) => item.addon.installationId === installation.id)).toBeTrue();
      expect(enqueued[0].addon.downloadUrl).toEqual("https://example.test/2002.zip");
    });

    it("should queue every dependency before any of them has finished", async () => {
      autoComplete = false;

      const done = service.installDependencies(createAddon(requiring("2002", "3003")));
      await new Promise((r) => setTimeout(r));

      expect(enqueuedIds()).toEqual(["2002", "3003"]);
      enqueued.forEach((item) => item.completion.resolve());
      await expectAsync(done).toBeResolved();
    });

    it("should install only one of two dependencies that ship the same folder", async () => {
      publish("2002", [], ["Shared"]);
      publish("3003", [], ["Shared"]);

      await service.installDependencies(createAddon(requiring("2002", "3003")));

      expect(enqueuedIds()).toEqual(["2002"]);
    });

    it("should look dependencies up with the parent's provider and installation", async () => {
      await service.installDependencies(createAddon(requiring("2002")));

      expect(addonProviderFactory.getProvider).toHaveBeenCalledWith("Curse");
      expect(provider.getById).toHaveBeenCalledWith("2002", installation);
      expect(addonStorage.getAllForInstallationIdAsync).toHaveBeenCalledWith(installation.id);
    });

    it("should save each dependency before installing it", async () => {
      const savedAtEnqueue: Array<string | undefined> = [];
      addonInstallService.enqueue.and.callFake((item) => {
        savedAtEnqueue.push(...installed.map((a) => a.externalId));
        enqueued.push(item);
        item.completion.resolve();
      });

      await service.installDependencies(createAddon(requiring("2002")));

      expect(savedAtEnqueue).toEqual(["2002"]);
    });

    it("should skip dependencies that are not required", async () => {
      const addon = createAddon({
        dependencies: [
          { externalAddonId: "2002", type: AddonDependencyType.Optional },
          { externalAddonId: "3003", type: AddonDependencyType.Embedded },
          { externalAddonId: "4004", type: AddonDependencyType.Other },
        ],
      });

      await service.installDependencies(addon);

      expect(provider.getById).not.toHaveBeenCalled();
      expect(enqueued.length).toEqual(0);
    });

    it("should skip dependencies already installed from the same provider", async () => {
      installed.push(createAddon({ id: "dep", externalId: "2002" }));

      await service.installDependencies(createAddon(requiring("2002", "3003")));

      expect(enqueuedIds()).toEqual(["3003"]);
    });

    it("should skip dependencies installed from another provider that carry this provider's id", async () => {
      installed.push(
        createAddon({
          id: "dep",
          providerName: "Wago",
          externalId: "wago-syndicator",
          externalIds: [
            { providerName: "Wago", id: "wago-syndicator" },
            { providerName: "Curse", id: "2002" },
          ],
        }),
      );

      await service.installDependencies(createAddon(requiring("2002")));

      expect(provider.getById).not.toHaveBeenCalled();
      expect(enqueued.length).toEqual(0);
    });

    it("should skip dependencies whose folders are already installed", async () => {
      publish("2002", [], ["Syndicator"]);
      installed.push(
        createAddon({ id: "dep", providerName: "Unknown", externalId: "", installedFolderList: ["Syndicator"] }),
      );

      await service.installDependencies(createAddon(requiring("2002")));

      expect(enqueued.length).toEqual(0);
    });

    it("should not match the same id from a different provider", async () => {
      installed.push(createAddon({ id: "other", providerName: "Wago", externalId: "2002" }));

      await service.installDependencies(createAddon(requiring("2002")));

      expect(enqueuedIds()).toEqual(["2002"]);
    });

    it("should skip dependencies the provider cannot find and keep going", async () => {
      delete catalog["2002"];

      await service.installDependencies(createAddon(requiring("2002", "3003")));

      expect(enqueuedIds()).toEqual(["3003"]);
    });

    it("should keep going when looking a dependency up throws", async () => {
      provider.getById.and.callFake((externalId) =>
        externalId === "2002" ? Promise.reject(new Error("network")) : Promise.resolve(catalog[externalId]),
      );

      await expectAsync(service.installDependencies(createAddon(requiring("2002", "3003")))).toBeResolved();
      expect(enqueuedIds()).toEqual(["3003"]);
    });

    it("should keep going when a dependency fails to install", async () => {
      addonInstallService.enqueue.and.callFake((item) => {
        enqueued.push(item);
        if (item.addon.externalId === "2002") {
          item.completion.reject(new Error("bad zip"));
        } else {
          item.completion.resolve();
        }
      });

      await expectAsync(service.installDependencies(createAddon(requiring("2002", "3003")))).toBeResolved();
      expect(enqueuedIds()).toEqual(["2002", "3003"]);
    });

    it("should install dependencies of dependencies", async () => {
      publish("2002", ["3003"]);

      await service.installDependencies(createAddon(requiring("2002")));

      expect(enqueuedIds()).toEqual(["2002", "3003"]);
    });

    it("should stop at a dependency cycle", async () => {
      publish("1001", ["2002"], ["Baganator"]);
      publish("2002", ["1001"]);

      await service.installAddon(createAddon(requiring("2002")));

      expect(enqueuedIds()).toEqual(["1001", "2002"]);
    });

    it("should install a dependency shared by concurrent installs only once", async () => {
      await Promise.all([
        service.installDependencies(createAddon({ id: "a", externalId: "a", ...requiring("2002") })),
        service.installDependencies(createAddon({ id: "b", externalId: "b", ...requiring("2002") })),
      ]);

      expect(enqueuedIds()).toEqual(["2002"]);
    });

    it("should try a dependency again once an earlier attempt has finished", async () => {
      addonInstallService.enqueue.and.callFake((item) => {
        enqueued.push(item);
        item.completion.reject(new Error("bad zip"));
      });

      await service.installDependencies(createAddon(requiring("2002")));
      installed.length = 0;
      await service.installDependencies(createAddon(requiring("2002")));

      expect(enqueuedIds()).toEqual(["2002", "2002"]);
    });

    it("should do nothing when the addon has no dependencies", async () => {
      await service.installDependencies(createAddon({ dependencies: [] }));
      await service.installDependencies(createAddon({ dependencies: undefined }));

      expect(provider.getById).not.toHaveBeenCalled();
      expect(enqueued.length).toEqual(0);
    });

    it("should do nothing when the addon's provider or installation is missing", async () => {
      await service.installDependencies(createAddon({ ...requiring("2002"), providerName: undefined }));
      await service.installDependencies(createAddon({ ...requiring("2002"), providerName: "Nope" }));
      await service.installDependencies(createAddon({ ...requiring("2002"), installationId: "missing" }));

      expect(provider.getById).not.toHaveBeenCalled();
      expect(enqueued.length).toEqual(0);
    });

    describe("wired into installs", () => {
      it("should install required dependencies after installing the addon", async () => {
        await service.installAddon(createAddon(requiring("2002")));

        expect(enqueuedIds()).toEqual(["1001", "2002"]);
      });

      it("should install the dependencies of an addon picked from search", async () => {
        const searchResult = createSearchResult({
          files: [
            createFile({
              dependencies: [
                { externalAddonId: "2002", type: AddonDependencyType.Required },
                { externalAddonId: "3003", type: AddonDependencyType.Optional },
              ],
            }),
          ],
        });

        await service.installPotentialAddon(searchResult, installation);

        expect(enqueuedIds()).toEqual(["1001", "2002"]);
      });

      it("should install the dependencies of an addon installed by id", async () => {
        publish("1001", ["2002"], ["Baganator"]);

        await service.installBaseAddon("1001", "Curse", installation);

        expect(enqueuedIds()).toEqual(["1001", "2002"]);
      });

      it("should not reuse the addon's progress callback for its dependencies", async () => {
        autoComplete = false;
        const onUpdate = jasmine.createSpy("onUpdate");

        const promise = service.installAddon(createAddon(requiring("2002")), onUpdate);
        await new Promise((r) => setTimeout(r));
        enqueued[0].completion.resolve();
        await new Promise((r) => setTimeout(r));

        expect(enqueuedIds()).toEqual(["1001", "2002"]);
        enqueued[1].completion.resolve();
        await promise;
        expect(onUpdate.calls.allArgs()).toEqual([[AddonInstallState.Pending, 0]]);
      });

      it("should still resolve the install when a dependency fails", async () => {
        addonInstallService.enqueue.and.callFake((item) => {
          enqueued.push(item);
          if (item.addon.externalId === "2002") {
            item.completion.reject(new Error("bad zip"));
          } else {
            item.completion.resolve();
          }
        });

        await expectAsync(service.installAddon(createAddon(requiring("2002")))).toBeResolved();
      });

      it("should not install dependencies when the addon itself fails", async () => {
        addonInstallService.enqueue.and.callFake((item) => {
          enqueued.push(item);
          item.completion.reject(new Error("bad zip"));
        });

        await expectAsync(service.installAddon(createAddon(requiring("2002")))).toBeRejectedWithError("bad zip");
        expect(enqueuedIds()).toEqual(["1001"]);
      });

      it("should not install dependencies on update", async () => {
        await service.updateAddon(createAddon(requiring("2002")));

        expect(enqueuedIds()).toEqual(["1001"]);
      });
    });
  });

  describe("getDependencyDetails", () => {
    const required = (...externalIds: string[]) =>
      externalIds.map((externalAddonId) => ({ externalAddonId, type: AddonDependencyType.Required }));

    beforeEach(() => {
      provider.getAll.and.callFake((_installation, ids) =>
        Promise.resolve({
          searchResults: ids
            .filter((id) => id !== "9999")
            .map((id) =>
              createSearchResult({
                externalId: id,
                name: `Addon ${id}`,
                files: [createFile({ folders: [`Addon${id}`] })],
              }),
            ),
          errors: [],
        }),
      );
    });

    it("should fetch the names of dependencies that are not installed in one call", async () => {
      const details = await service.getDependencyDetails(required("2002", "3003"), "Curse", installation);

      expect(details).toEqual([
        { externalAddonId: "2002", name: "Addon 2002", installed: false },
        { externalAddonId: "3003", name: "Addon 3003", installed: false },
      ]);
      expect(provider.getAll).toHaveBeenCalledOnceWith(installation, ["2002", "3003"]);
    });

    it("should use installed addons without asking the provider", async () => {
      installed.push(createAddon({ id: "dep", name: "Syndicator", externalId: "2002" }));

      const details = await service.getDependencyDetails(required("2002"), "Curse", installation);

      expect(details).toEqual([{ externalAddonId: "2002", name: "Syndicator", installed: true }]);
      expect(provider.getAll).not.toHaveBeenCalled();
    });

    it("should only fetch the dependencies that are not installed, keeping the given order", async () => {
      installed.push(
        createAddon({
          id: "dep",
          name: "Syndicator (Wago)",
          providerName: "Wago",
          externalId: "wago-syndicator",
          externalIds: [{ providerName: "Curse", id: "3003" }],
        }),
      );

      const details = await service.getDependencyDetails(required("2002", "3003"), "Curse", installation);

      expect(details.map((d) => [d.name, d.installed])).toEqual([
        ["Addon 2002", false],
        ["Syndicator (Wago)", true],
      ]);
      expect(provider.getAll).toHaveBeenCalledOnceWith(installation, ["2002"]);
    });

    it("should mark a dependency installed when its folders already are", async () => {
      installed.push(
        createAddon({ id: "manual", providerName: "Unknown", externalId: "", installedFolderList: ["Addon2002"] }),
      );

      const details = await service.getDependencyDetails(required("2002"), "Curse", installation);

      expect(details).toEqual([{ externalAddonId: "2002", name: "Addon 2002", installed: true }]);
    });

    it("should fall back to the id when the provider cannot resolve a dependency", async () => {
      const details = await service.getDependencyDetails(required("9999", "2002"), "Curse", installation);

      expect(details.map((d) => d.name)).toEqual(["9999", "Addon 2002"]);
    });

    it("should fall back to ids when the provider call fails", async () => {
      provider.getAll.and.rejectWith(new Error("network"));

      const details = await service.getDependencyDetails(required("2002"), "Curse", installation);

      expect(details).toEqual([{ externalAddonId: "2002", name: "2002", installed: false }]);
    });

    it("should fall back to ids when the provider is missing", async () => {
      const details = await service.getDependencyDetails(required("2002"), "Nope", installation);

      expect(details).toEqual([{ externalAddonId: "2002", name: "2002", installed: false }]);
    });

    it("should return nothing for no dependencies", async () => {
      expect(await service.getDependencyDetails([], "Curse", installation)).toEqual([]);
      expect(addonStorage.getAllForInstallationIdAsync).not.toHaveBeenCalled();
    });
  });

  describe("removeAddon", () => {
    it("should delete the addon folders and remove it from storage", async () => {
      const addon = createAddon({ installedFolderList: ["Baganator"] });

      await service.removeAddon(addon);

      expect(fileService.deleteIfExists).toHaveBeenCalledWith(pathJoin(ADDON_FOLDER_PATH, "Baganator"));
      expect(addonStorage.removeAsync).toHaveBeenCalledWith(addon);
    });

    it("should not touch dependencies unless asked", async () => {
      const addon = createAddon({
        dependencies: [{ externalAddonId: "2002", type: AddonDependencyType.Required }],
      });

      await service.removeAddon(addon);

      expect(addonStorage.getByExternalIdAsync).not.toHaveBeenCalled();
      expect(addonStorage.removeAsync).toHaveBeenCalledTimes(1);
    });

    it("should remove the installed dependencies when asked", async () => {
      const dependency = createAddon({ id: "dep-1", externalId: "2002", installedFolderList: ["Syndicator"] });
      addonStorage.getByExternalIdAsync.and.callFake((externalId) =>
        Promise.resolve(externalId === "2002" ? dependency : undefined),
      );
      const addon = createAddon({
        installedFolderList: ["Baganator"],
        dependencies: [
          { externalAddonId: "2002", type: AddonDependencyType.Required },
          { externalAddonId: "9999", type: AddonDependencyType.Required },
        ],
      });

      await service.removeAddon(addon, true);

      expect(addonStorage.removeAsync).toHaveBeenCalledWith(addon);
      expect(addonStorage.removeAsync).toHaveBeenCalledWith(dependency);
      expect(addonStorage.removeAsync).toHaveBeenCalledTimes(2);
      expect(fileService.deleteIfExists).toHaveBeenCalledWith(pathJoin(ADDON_FOLDER_PATH, "Syndicator"));
    });

    it("should emit the removed addon id", async () => {
      const removed: string[] = [];
      service.addonRemoved$.subscribe((id) => removed.push(id));

      await service.removeAddon(createAddon());

      expect(removed).toEqual(["addon-1"]);
    });
  });
});
