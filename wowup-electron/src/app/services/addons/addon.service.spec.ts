/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-argument */
import { join as pathJoin } from "path";
import { Subject } from "rxjs";
import {
  Addon,
  AddonChannelType,
  AddonDependencyType,
  AddonFolder,
  AddonProvider,
  AddonSearchResult,
  AddonSearchResultFile,
  AddonWarningType,
  Toc,
  WowClientType,
  WowInstallation,
} from "wowup-lib-core";

import { IPC_ADDONS_GET_ALL_FOR_INSTALLATION } from "../../../common/constants";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { AnalyticsService } from "../analytics/analytics.service";
import { ElectronService } from "../electron/electron.service";
import { FileService } from "../files/file.service";
import { AddonStorageService } from "../storage/addon-storage.service";
import { TocService } from "../toc/toc.service";
import { WarcraftInstallationService } from "../warcraft/warcraft-installation.service";
import { WarcraftService } from "../warcraft/warcraft.service";
import { WowUpService } from "../wowup/wowup.service";
import { AddonSyncApiService } from "../api/addon-sync-api.service";
import { AddonSyncError, GenericProviderError } from "../../errors";
import { AddonInstallService, InstallQueueItem } from "./addon-install.service";
import { AddonService, DependencyInstallEvent, DependencyInstallState } from "./addon.service";
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
  let wowUpService: jasmine.SpyObj<WowUpService>;
  let syncApi: jasmine.SpyObj<AddonSyncApiService>;

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

    provider = jasmine.createSpyObj<AddonProvider>("AddonProvider", ["getById", "getAll", "isValidAddonId"], {
      name: "Curse",
    });
    provider.isValidAddonId.and.returnValue(true);

    addonStorage = jasmine.createSpyObj<AddonStorageService>("AddonStorageService", [
      "setAsync",
      "removeAsync",
      "getByExternalIdAsync",
      "getAvailableForUpdate",
      "getAllForInstallationIdAsync",
      "getAutoUpdateEnabled",
      "replaceAllForInstallation",
    ]);
    addonStorage.getAutoUpdateEnabled.and.resolveTo([]);
    installed = [];
    addonStorage.setAsync.and.callFake((_key, value) => {
      installed = [...installed.filter((a) => a.id !== value.id), value];
      return Promise.resolve();
    });
    addonStorage.getAllForInstallationIdAsync.and.callFake((id) =>
      Promise.resolve(installed.filter((a) => a.installationId === id)),
    );
    addonStorage.replaceAllForInstallation.and.callFake((id, addons) => {
      installed = [...installed.filter((a) => a.installationId !== id), ...addons];
      return Promise.resolve();
    });
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
      ["getWowInstallation", "getWowInstallationsAsync", "refreshGameVersions"],
      {
        wowInstallations$: new Subject<WowInstallation[]>().asObservable(),
        legacyInstallationSrc$: new Subject<WowInstallation[]>().asObservable(),
      },
    );
    warcraftInstallationService.getWowInstallation.and.callFake((id) =>
      id === installation.id ? installation : undefined,
    );
    warcraftInstallationService.getWowInstallationsAsync.and.callFake(() => Promise.resolve([installation]));
    warcraftInstallationService.refreshGameVersions.and.callFake(() => Promise.resolve([installation]));

    addonProviderFactory = jasmine.createSpyObj<AddonProviderFactory>("AddonProviderFactory", [
      "getProvider",
      "getBatchAddonProviders",
      "getStandardAddonProviders",
      "getEnabledAddonProviders",
      "getProviderNames",
      "getNonRescanProviderNames",
    ]);
    addonProviderFactory.getProvider.and.callFake(((name: string) => (name === "Curse" ? provider : undefined)) as any);
    addonProviderFactory.getBatchAddonProviders.and.returnValue([]);
    addonProviderFactory.getStandardAddonProviders.and.returnValue([provider]);
    addonProviderFactory.getEnabledAddonProviders.and.returnValue([]);
    addonProviderFactory.getProviderNames.and.returnValue(["Curse"]);
    addonProviderFactory.getNonRescanProviderNames.and.returnValue(["GitHub"]);

    wowUpService = jasmine.createSpyObj<WowUpService>("WowUpService", ["getUseSymlinkMode"]);
    wowUpService.getUseSymlinkMode.and.resolveTo(false);

    // Main applies the sync and hands the addons back as copies, like a real ipc round trip
    syncApi = jasmine.createSpyObj<AddonSyncApiService>("AddonSyncApiService", [
      "prepareScan",
      "completeScan",
      "applySync",
    ]);
    syncApi.applySync.and.callFake((request) =>
      Promise.resolve({
        addons: request.addons.map((a) => ({ ...a })),
        failureAddonNames: request.failures.map(() => undefined),
        noFileAddons: [],
      }),
    );
    syncApi.prepareScan.and.resolveTo({ addonFolders: [] });
    syncApi.completeScan.and.resolveTo([]);

    service = new AddonService(
      addonStorage,
      addonInstallService,
      analyticsService,
      warcraftService,
      wowUpService,
      fileService,
      {} as TocService,
      warcraftInstallationService,
      addonProviderFactory,
      syncApi,
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

    it("should update the addon before installing its missing dependencies", async () => {
      provider.getById.and.resolveTo(
        createSearchResult({
          externalId: "2002",
          name: "Mouse Media",
          files: [createFile({ folders: ["MouseMedia"] })],
        }),
      );

      await service.updateAddon(
        createAddon({ dependencies: [{ externalAddonId: "2002", type: AddonDependencyType.Required }] }),
      );

      expect(enqueued.map((item) => [item.addon.externalId, item.installType])).toEqual([
        ["1001", "update"],
        ["2002", "install"],
      ]);
    });

    it("should not install dependencies that are already installed", async () => {
      installed = [createAddon({ id: "dep-1", name: "Mouse Media", externalId: "2002" })];

      await service.updateAddon(
        createAddon({ dependencies: [{ externalAddonId: "2002", type: AddonDependencyType.Required }] }),
      );

      expect(enqueued.map((item) => item.addon.externalId)).toEqual(["1001"]);
      expect(provider.getById).not.toHaveBeenCalled();
    });
  });

  describe("processAutoUpdates", () => {
    function createPendingUpdate(overrides: Partial<Addon> = {}): Addon {
      return createAddon({
        autoUpdateEnabled: true,
        installedVersion: "1.1.0",
        latestVersion: "1.2.0",
        gameVersion: ["12.1.5"],
        ...overrides,
      });
    }

    beforeEach(() => {
      installation.gameVersion = "12.1.5";
    });

    it("updates addons whose release the installation can run", async () => {
      const addon = createPendingUpdate();
      addonStorage.getAutoUpdateEnabled.and.resolveTo([addon]);

      const result = await service.processAutoUpdates();

      expect(result.updated).toEqual([addon]);
      expect(result.skipped).toEqual([]);
      expect(enqueued.map((item) => item.addon)).toEqual([addon]);
    });

    it("holds back an update that needs a newer game version than the installation runs", async () => {
      const addon = createPendingUpdate({ gameVersion: ["12.1.7"] });
      addonStorage.getAutoUpdateEnabled.and.resolveTo([addon]);

      const result = await service.processAutoUpdates();

      expect(result.updated).toEqual([]);
      expect(result.skipped).toEqual([addon]);
      expect(enqueued).toEqual([]);
    });

    it("still updates the compatible addons in the same pass", async () => {
      const tooNew = createPendingUpdate({ id: "too-new", externalId: "1", gameVersion: ["12.1.7"] });
      const fine = createPendingUpdate({ id: "fine", externalId: "2", gameVersion: ["12.1.5"] });
      addonStorage.getAutoUpdateEnabled.and.resolveTo([tooNew, fine]);

      const result = await service.processAutoUpdates();

      expect(result.updated).toEqual([fine]);
      expect(result.skipped).toEqual([tooNew]);
    });

    it("updates once the user ignored the mismatch for the current game version", async () => {
      installation.ignoredCompatibilityVersion = "12.1.5";
      const addon = createPendingUpdate({ gameVersion: ["12.1.7"] });
      addonStorage.getAutoUpdateEnabled.and.resolveTo([addon]);

      const result = await service.processAutoUpdates();

      expect(result.updated).toEqual([addon]);
      expect(result.skipped).toEqual([]);
    });

    it("holds back again after the installation is patched to another game version", async () => {
      installation.ignoredCompatibilityVersion = "12.1.5";
      installation.gameVersion = "12.1.6";
      const addon = createPendingUpdate({ gameVersion: ["12.1.7"] });
      addonStorage.getAutoUpdateEnabled.and.resolveTo([addon]);

      const result = await service.processAutoUpdates();

      expect(result.skipped).toEqual([addon]);
    });

    it("updates when the game version of the installation is unknown", async () => {
      installation.gameVersion = undefined;
      const addon = createPendingUpdate({ gameVersion: ["12.1.7"] });
      addonStorage.getAutoUpdateEnabled.and.resolveTo([addon]);

      const result = await service.processAutoUpdates();

      expect(result.updated).toEqual([addon]);
    });

    it("updates when the release does not say which game version it targets", async () => {
      const addon = createPendingUpdate({ gameVersion: undefined });
      addonStorage.getAutoUpdateEnabled.and.resolveTo([addon]);

      const result = await service.processAutoUpdates();

      expect(result.updated).toEqual([addon]);
    });

    it("does not hold back updates on a PTR installation", async () => {
      installation.clientType = WowClientType.RetailPtr;
      const addon = createPendingUpdate({ gameVersion: ["12.1.7"] });
      addonStorage.getAutoUpdateEnabled.and.resolveTo([addon]);

      const result = await service.processAutoUpdates();

      expect(result.updated).toEqual([addon]);
    });

    it("reads the game versions again before deciding", async () => {
      await service.processAutoUpdates();

      expect(warcraftInstallationService.refreshGameVersions).toHaveBeenCalledTimes(1);
    });

    it("decides with the stored game version when it cannot be refreshed", async () => {
      warcraftInstallationService.refreshGameVersions.and.rejectWith(new Error("no product.db"));
      const addon = createPendingUpdate({ gameVersion: ["12.1.7"] });
      addonStorage.getAutoUpdateEnabled.and.resolveTo([addon]);

      const result = await service.processAutoUpdates();

      expect(result.skipped).toEqual([addon]);
    });
  });

  // What a sync does to an addon is main's job now, see app/services/addons/sync-results.spec.ts
  describe("syncClient", () => {
    it("should hand the provider's results to main with the addons it asked about", async () => {
      const addon = createAddon();
      const result = createSearchResult();
      installed = [addon];
      provider.getAll.and.resolveTo({ searchResults: [result], errors: [] });

      await service.syncClient(installation);

      expect(provider.getAll).toHaveBeenCalledWith(installation, ["1001"]);
      expect(syncApi.applySync).toHaveBeenCalledWith({
        providerName: "Curse",
        addons: [addon],
        searchResults: [result],
        failures: [],
      });
    });

    it("should copy what main applied back onto the caller's addons", async () => {
      const addon = createAddon({ downloadUrl: "https://example.test/old.zip" });
      installed = [addon];
      provider.getAll.and.resolveTo({ searchResults: [createSearchResult()], errors: [] });
      syncApi.applySync.and.resolveTo({
        addons: [{ ...addon, downloadUrl: "https://example.test/new.zip" }],
        failureAddonNames: [],
        noFileAddons: [],
      });

      await service.syncClient(installation);

      expect(addon.downloadUrl).toEqual("https://example.test/new.zip");
    });

    it("should match what main applied to the caller's addons by id, not by position", async () => {
      const first = createAddon({ id: "a-1", externalId: "1001", name: "Baganator" });
      const second = createAddon({ id: "a-2", externalId: "1002", name: "Syndicator" });
      installed = [first, second];
      provider.getAll.and.resolveTo({ searchResults: [createSearchResult()], errors: [] });
      syncApi.applySync.and.resolveTo({
        addons: [{ ...second, summary: "updated" }],
        failureAddonNames: [],
        noFileAddons: [],
      });

      await service.syncClient(installation);

      expect(first.summary).toBeUndefined();
      expect(second.summary).toEqual("updated");
    });

    it("should pass a provider warning to main and report the error with the addon's name", async () => {
      const addon = createAddon();
      installed = [addon];
      const error = Object.assign(new GenericProviderError(undefined, "gone", AddonWarningType.MissingOnProvider), {
        addonId: "1001",
      });
      provider.getAll.and.resolveTo({ searchResults: [], errors: [error] });
      syncApi.applySync.and.resolveTo({ addons: [addon], failureAddonNames: ["Baganator"], noFileAddons: [] });
      const reported: AddonSyncError[] = [];
      service.syncError$.subscribe((e) => reported.push(e));

      await service.syncClient(installation);

      expect(syncApi.applySync.calls.mostRecent().args[0].failures).toEqual([
        { addonId: "1001", warningType: AddonWarningType.MissingOnProvider },
      ]);
      expect(reported.map((e) => [e.addonName, e.innerError])).toEqual([["Baganator", error]]);
    });

    it("should report the addons main found no file for", async () => {
      installed = [createAddon()];
      provider.getAll.and.resolveTo({ searchResults: [createSearchResult({ files: [] })], errors: [] });
      syncApi.applySync.and.resolveTo({
        addons: installed,
        failureAddonNames: [],
        noFileAddons: [{ name: "Baganator", providerName: "Curse" }],
      });
      const reported: AddonSyncError[] = [];
      service.syncError$.subscribe((e) => reported.push(e));

      await service.syncClient(installation);

      expect(reported.map((e) => [e.addonName, e.providerName, e.installationName])).toEqual([
        ["Baganator", "Curse", "Retail"],
      ]);
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

    it("should look every dependency up before any lookup has answered", async () => {
      provider.getById.and.returnValue(new Promise(() => {}));

      void service.installDependencies(createAddon(requiring("2002", "3003")));
      await new Promise((r) => setTimeout(r));

      expect(provider.getById.calls.allArgs().map((args) => args[0])).toEqual(["2002", "3003"]);
    });

    describe("progress", () => {
      function progressOf(events: DependencyInstallEvent[]) {
        return events.map((e) => [e.addon.externalId, e.state, e.completed, e.total]);
      }

      it("should report resolving, then each dependency as it finishes, then complete", async () => {
        const events: DependencyInstallEvent[] = [];
        service.dependencyInstall$.subscribe((e) => events.push(e));

        await service.installDependencies(createAddon(requiring("2002", "3003")));

        expect(progressOf(events)).toEqual([
          ["1001", DependencyInstallState.Resolving, 0, 2],
          ["1001", DependencyInstallState.Installing, 0, 2],
          ["1001", DependencyInstallState.Installing, 1, 2],
          ["1001", DependencyInstallState.Installing, 2, 2],
          ["1001", DependencyInstallState.Complete, 2, 2],
        ]);
      });

      it("should count only the dependencies that need installing", async () => {
        installed.push(createAddon({ id: "dep", externalId: "2002" }));
        const events: DependencyInstallEvent[] = [];
        service.dependencyInstall$.subscribe((e) => events.push(e));

        await service.installDependencies(createAddon(requiring("2002", "3003")));

        expect(events.filter((e) => e.state === DependencyInstallState.Installing).map((e) => e.total)).toEqual([1, 1]);
      });

      it("should report complete when no dependency needs installing", async () => {
        const events: DependencyInstallEvent[] = [];
        service.dependencyInstall$.subscribe((e) => events.push(e));

        await service.installDependencies(createAddon({ ...requiring("2002"), providerName: "Nope" }));

        expect(events.map((e) => e.state)).toEqual([DependencyInstallState.Resolving, DependencyInstallState.Complete]);
        expect(service.getDependencyInstallStatuses()).toEqual([]);
      });

      it("should report nothing for an addon without dependencies", async () => {
        const events: DependencyInstallEvent[] = [];
        service.dependencyInstall$.subscribe((e) => events.push(e));

        await service.installAddon(createAddon({ dependencies: [] }));

        expect(events).toEqual([]);
      });

      it("should keep an addon installing from the start of its install until its dependencies are done", async () => {
        autoComplete = false;
        const installing: boolean[] = [];
        service.installing$.subscribe((value) => installing.push(value));

        const promise = service.installAddon(createAddon(requiring("2002")));
        expect(service.isInstalling()).toBeTrue();
        expect(service.getDependencyInstallStatuses().map((e) => e.state)).toEqual([DependencyInstallState.Resolving]);

        await new Promise((r) => setTimeout(r));
        enqueued[0].completion.resolve();
        await new Promise((r) => setTimeout(r));
        expect(service.isInstalling()).toBeTrue();
        expect(service.getDependencyInstallStatuses().map((e) => e.state)).toEqual([DependencyInstallState.Installing]);

        enqueued[1].completion.resolve();
        await promise;
        expect(service.isInstalling()).toBeFalse();
        expect(service.getDependencyInstallStatuses()).toEqual([]);
        expect(installing).toEqual([false, true, false]);
      });

      it("should drop the addon's dependency progress when the addon itself fails", async () => {
        addonInstallService.enqueue.and.callFake((item) => {
          enqueued.push(item);
          item.completion.reject(new Error("bad zip"));
        });

        await expectAsync(service.installAddon(createAddon(requiring("2002")))).toBeRejectedWithError("bad zip");
        expect(service.getDependencyInstallStatuses()).toEqual([]);
        expect(service.isInstalling()).toBeFalse();
      });
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

      it("should install required dependencies after updating the addon", async () => {
        await service.updateAddon(createAddon(requiring("2002")));

        expect(enqueuedIds()).toEqual(["1001", "2002"]);
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

  describe("matchByRepository", () => {
    let repoProvider: jasmine.SpyObj<AddonProvider>;

    function repoFolder(name: string, toc: Partial<Toc>): AddonFolder {
      return { name, path: `/AddOns/${name}`, tocs: [{ fileName: `${name}.toc`, ...toc }] } as unknown as AddonFolder;
    }

    function matchByRepository(folders: AddonFolder[]): Promise<void> {
      return (service as any).matchByRepository(installation, AddonChannelType.Stable, folders);
    }

    beforeEach(() => {
      repoProvider = jasmine.createSpyObj<AddonProvider>("RepoProvider", ["isValidAddonUri", "searchByUrl"]);
      repoProvider.isValidAddonUri.and.callFake((url: URL) => url.hostname === "github.com");
      repoProvider.searchByUrl.and.resolveTo({ searchResult: createSearchResult({ name: "AddonA" }) });
      (addonProviderFactory as any).getEnabledAddonProviders = () => [repoProvider];
      (service as any)._tocService = { getTocForGameType2: (_name: string, tocs: Toc[]) => tocs[0] };
    });

    it("matches a folder through the provider that knows its X-Repository", async () => {
      const addonFolder = repoFolder("AddonA", { repository: "https://github.com/someone/addon-a", version: "1.0.1" });

      await matchByRepository([addonFolder]);

      expect(repoProvider.searchByUrl).toHaveBeenCalledOnceWith(
        new URL("https://github.com/someone/addon-a"),
        installation,
      );
      expect(addonFolder.matchingAddon).toEqual(
        jasmine.objectContaining({
          providerName: "Curse",
          externalId: "1001",
          installedVersion: "1.0.1",
          installedFolderList: ["AddonA"],
        }),
      );
      expect(addonFolder.matchingAddon?.isManuallyLinked).toBeUndefined();
    });

    it("leaves the folder unknown when the provider has no release for the client", async () => {
      repoProvider.searchByUrl.and.resolveTo({ searchResult: createSearchResult({ files: [] }) });
      const addonFolder = repoFolder("AddonA", { repository: "https://github.com/someone/addon-a" });

      await matchByRepository([addonFolder]);

      expect(addonFolder.matchingAddon).toBeUndefined();
    });

    it("skips folders without a repository a provider knows", async () => {
      const folders = [
        repoFolder("NoRepo", {}),
        repoFolder("NotAUrl", { repository: "someone/addon-a" }),
        repoFolder("Unknown", { repository: "https://example.test/addon-a" }),
      ];

      await matchByRepository(folders);

      expect(repoProvider.searchByUrl).not.toHaveBeenCalled();
      expect(folders.every((folder) => folder.matchingAddon === undefined)).toBeTrue();
    });
  });

  describe("rematchUnknownAddons", () => {
    let scanSpy: jasmine.Spy;

    function unknown(id: string, folder: string): Addon {
      return createAddon({
        id,
        name: folder,
        providerName: "Unknown",
        externalId: "",
        isIgnored: true,
        installedFolderList: [folder],
      });
    }

    beforeEach(() => {
      scanSpy = spyOn<any>(service, "scanAddons").and.resolveTo([]);
    });

    it("does not scan when every addon is identified", async () => {
      installed = [createAddon()];

      expect(await service.rematchUnknownAddons(installation)).toBe(0);
      expect(scanSpy).not.toHaveBeenCalled();
    });

    it("scans only the unknown folders whose TOC references a provider, without scan progress", async () => {
      installed = [createAddon(), unknown("u1", "AddonA"), unknown("u2", "AddonA_Data"), unknown("u3", "Local")];
      const tocs: { [folder: string]: Partial<Toc> } = {
        AddonA: { curseProjectId: "2002" },
        AddonA_Data: { repository: "https://github.com/someone/addon-a" },
        Local: { title: "Local" },
        Baganator: { curseProjectId: "1001" },
      };
      (service as any)._tocService = { getTocForGameType2: (name: string) => tocs[name] };

      await service.rematchUnknownAddons(installation);

      const [, { save, folderNames, folderFilter, quiet }] = scanSpy.calls.mostRecent().args;
      const accepted = (folderNames as string[]).filter((name) =>
        (folderFilter as (folder: AddonFolder) => boolean)({ name, tocs: [] } as unknown as AddonFolder),
      );
      expect(folderNames).toEqual(["AddonA", "AddonA_Data", "Local"]);
      expect(accepted).toEqual(["AddonA", "AddonA_Data"]);
      expect(quiet).toBeTrue();
      expect(save).toBeFalsy();
    });

    it("replaces the unknown addons it identifies and keeps everything else", async () => {
      const known = createAddon();
      const stillUnknown = unknown("u3", "LocalAddon");
      installed = [known, unknown("u1", "AddonA"), unknown("u2", "AddonA_Data"), stillUnknown];
      const addonA = createAddon({
        id: "addon-a",
        name: "AddonA",
        externalId: "2002",
        installedFolderList: ["AddonA", "AddonA_Data"],
      });
      scanSpy.and.resolveTo([addonA, unknown("u3-new", "LocalAddon")]);

      expect(await service.rematchUnknownAddons(installation)).toBe(1);

      expect(installed.map((a) => a.id).sort()).toEqual(["addon-1", "addon-a", "u3"]);
    });

    it("does not add an identified addon that is installed already", async () => {
      installed = [createAddon({ installedFolderList: ["Baganator"] }), unknown("u1", "Baganator_Options")];
      scanSpy.and.resolveTo([createAddon({ id: "dupe", installedFolderList: ["Baganator_Options"] })]);

      await service.rematchUnknownAddons(installation);

      expect(installed.map((a) => a.id)).toEqual(["addon-1"]);
    });

    it("leaves the addons alone when nothing new is identified", async () => {
      installed = [unknown("u1", "LocalAddon")];
      scanSpy.and.resolveTo([unknown("u1-new", "LocalAddon")]);

      expect(await service.rematchUnknownAddons(installation)).toBe(0);
      expect(addonStorage.replaceAllForInstallation).not.toHaveBeenCalled();
    });

    it("is not run by a sync, only on request", async () => {
      installed = [unknown("u1", "AddonA")];

      await service.syncAllClients();
      await service.syncClient(installation);

      expect(scanSpy).not.toHaveBeenCalled();
    });
  });

  describe("linkAddon", () => {
    function createUnknownAddon(overrides: Partial<Addon> = {}): Addon {
      return createAddon({
        id: "unknown-1",
        name: "AddonC",
        providerName: "Unknown",
        externalId: "",
        installedVersion: "1.0.1",
        installedFolderList: ["AddonC"],
        installedFolders: "AddonC",
        isIgnored: true,
        ...overrides,
      });
    }

    it("links the installed addon to the provider's addon without reinstalling it", async () => {
      const unknown = createUnknownAddon();

      const linked = await service.linkAddon(unknown, createSearchResult({ name: "Addon C" }), installation);

      expect(linked.id).toEqual("unknown-1");
      expect(linked.providerName).toEqual("Curse");
      expect(linked.externalId).toEqual("1001");
      expect(linked.name).toEqual("Addon C");
      expect(linked.isIgnored).toBeFalse();
      expect(linked.isManuallyLinked).toBeTrue();
      expect(linked.installedVersion).toEqual("1.0.1");
      expect(linked.installedFolderList).toEqual(["AddonC"]);
      expect(linked.latestVersion).toEqual("1.2.0");
      expect(installed).toEqual([linked]);
      expect(enqueued.length).toEqual(0);
    });

    it("leaves the installed release unknown unless the latest release is the installed version", async () => {
      const outdated = await service.linkAddon(createUnknownAddon(), createSearchResult(), installation);
      const current = await service.linkAddon(
        createUnknownAddon({ installedVersion: "v1.2.0" }),
        createSearchResult(),
        installation,
      );

      expect(outdated.installedExternalReleaseId).toBeUndefined();
      expect(current.installedExternalReleaseId).toEqual("5001");
    });

    it("fails when the provider has no release for the client", async () => {
      await expectAsync(
        service.linkAddon(createUnknownAddon(), createSearchResult({ files: [] }), installation),
      ).toBeRejectedWithError(/No release/);
      expect(installed.length).toEqual(0);
    });
  });

  describe("rescanInstallation", () => {
    /** The addon store in the main process, keyed by addon id */
    let store: Map<string, Addon>;
    /** Main's half of a scan, which saves the result when asked */
    let scanSpy: jasmine.Spy;
    let scanService: AddonService;

    /** Every IPC call takes a turn of the event loop, like a real round trip to the main process */
    function createElectronService(): ElectronService {
      return {
        invoke: async (channel: string, ...args: any[]) => {
          await new Promise((r) => setTimeout(r));
          switch (channel) {
            case IPC_ADDONS_GET_ALL_FOR_INSTALLATION:
              return [...store.values()].filter((a) => a.installationId === args[0]);
            default:
              return [];
          }
        },
      } as unknown as ElectronService;
    }

    function storedNames(): Array<string | undefined> {
      return [...store.values()].map((a) => a.name).sort();
    }

    beforeEach(() => {
      store = new Map();
      scanService = new AddonService(
        new AddonStorageService(createElectronService()),
        addonInstallService,
        analyticsService,
        warcraftService,
        wowUpService,
        fileService,
        {} as TocService,
        warcraftInstallationService,
        addonProviderFactory,
        syncApi,
      );

      // Every scan makes new records with new ids, like the real folder scan does
      let scanCt = 0;
      scanSpy = syncApi.completeScan.and.callFake(async (request) => {
        scanCt += 1;
        await new Promise((r) => setTimeout(r, 5));
        const addons = ["Baganator", "Syndicator"].map((name) =>
          createAddon({ id: `${name}-${scanCt}`, name, externalId: name }),
        );
        if (request.save) {
          for (const [id, a] of [...store]) {
            if (a.installationId === request.installationId) {
              store.delete(id);
            }
          }
          addons.forEach((a) => store.set(a.id, a));
        }
        return addons;
      });
    });

    it("should ask main to keep the addons a scan can't find again and to save the result", async () => {
      await scanService.rescanInstallation(installation);

      expect(syncApi.prepareScan).toHaveBeenCalledWith({
        installationId: installation.id,
        nonRescanProviders: ["GitHub"],
      });
      expect(scanSpy.calls.mostRecent().args[0]).toEqual(
        jasmine.objectContaining({
          installationId: installation.id,
          providerNames: ["Curse"],
          nonRescanProviders: ["GitHub"],
          save: true,
        }),
      );
    });

    it("should let the providers match the prepared folders before main completes the scan", async () => {
      const folder = { name: "Baganator", path: "Baganator", status: "Pending", tocs: [{}] } as any;
      const matched = createAddon();
      const scanningProvider = jasmine.createSpyObj<AddonProvider>("AddonProvider", ["scan"], { name: "Curse" });
      scanningProvider.scan.and.callFake((_install, _channel, folders) => {
        folders.forEach((af) => (af.matchingAddon = matched));
        return Promise.resolve();
      });
      addonProviderFactory.getEnabledAddonProviders.and.returnValue([scanningProvider]);
      syncApi.prepareScan.and.resolveTo({ addonFolders: [folder] });

      await scanService.rescanInstallation(installation);

      expect(scanningProvider.scan).toHaveBeenCalledWith(installation, AddonChannelType.Stable, [folder]);
      expect(scanSpy.calls.mostRecent().args[0].addonFolders[0].matchingAddon).toBe(matched);
    });

    it("should save each addon once when several loads find nothing saved at the same time", async () => {
      await Promise.all([
        scanService.getAddons(installation),
        scanService.getAddons(installation),
        scanService.getAddons(installation),
      ]);

      expect(storedNames()).toEqual(["Baganator", "Syndicator"]);
      expect(scanSpy).toHaveBeenCalledTimes(1);
    });

    it("should give every caller the addons of the shared scan", async () => {
      const results = await Promise.all([scanService.getAddons(installation), scanService.getAddons(installation)]);

      expect(results.map((r) => r.map((a) => a.id))).toEqual([
        ["Baganator-1", "Syndicator-1"],
        ["Baganator-1", "Syndicator-1"],
      ]);
    });

    it("should save each addon once when rescans overlap", async () => {
      await scanService.getAddons(installation, true);

      await Promise.all([scanService.getAddons(installation, true), scanService.getAddons(installation, true)]);

      expect(storedNames()).toEqual(["Baganator", "Syndicator"]);
    });

    it("should scan again after the running scan when a rescan is asked for mid-scan", async () => {
      const first = scanService.rescanInstallation(installation);
      const second = scanService.rescanInstallation(installation);
      const third = scanService.rescanInstallation(installation);

      const [, secondResult, thirdResult] = await Promise.all([first, second, third]);

      expect(scanSpy).toHaveBeenCalledTimes(2);
      expect(secondResult.map((a) => a.id)).toEqual(["Baganator-2", "Syndicator-2"]);
      expect(thirdResult).toBe(secondResult);
      expect([...store.keys()].sort()).toEqual(["Baganator-2", "Syndicator-2"]);
    });

    it("should run a waiting rescan even when the running one fails", async () => {
      scanSpy.and.returnValues(Promise.reject(new Error("disk")), Promise.resolve([createAddon({ id: "ok" })]));

      const failed = scanService.rescanInstallation(installation);
      const next = scanService.rescanInstallation(installation);

      await expectAsync(failed).toBeRejectedWithError("disk");
      expect((await next).map((a) => a.id)).toEqual(["ok"]);
    });

    it("should start a new scan once the last one has finished", async () => {
      await scanService.rescanInstallation(installation);
      await scanService.rescanInstallation(installation);

      expect(scanSpy).toHaveBeenCalledTimes(2);
    });
  });
});
