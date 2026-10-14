/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-argument */
import { join as pathJoin } from "path";
import {
  Addon,
  AddonChannelType,
  AddonDependencyType,
  AddonProvider,
  WowClientType,
  WowInstallation,
} from "wowup-lib-core";

import { USER_ACTION_ADDON_INSTALL } from "../../../common/constants";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { AnalyticsService } from "../analytics/analytics.service";
import { DownloadService } from "../download/download.service";
import { FileService } from "../files/file.service";
import { AddonStorageService } from "../storage/addon-storage.service";
import { TocService } from "../toc/toc.service";
import { WarcraftInstallationService } from "../warcraft/warcraft-installation.service";
import { WarcraftService } from "../warcraft/warcraft.service";
import { WowUpService } from "../wowup/wowup.service";
import { AddonInstallService, InstallQueueItem, InstallType } from "./addon-install.service";
import { AddonProviderFactory } from "./addon.provider.factory";

const ADDON_FOLDER_PATH = pathJoin("wow", "_retail_", "Interface", "AddOns");
const DOWNLOADS_FOLDER_PATH = pathJoin("wowup", "downloads");
const DOWNLOADED_ZIP_PATH = pathJoin(DOWNLOADS_FOLDER_PATH, "baganator.zip");
const UNZIPPED_PATH = pathJoin(DOWNLOADS_FOLDER_PATH, "unzipped");

interface Deferred {
  promise: Promise<void>;
  completion: { resolve: () => void; reject: (e: unknown) => void };
}

function createDeferred(): Deferred {
  let completion: Deferred["completion"] = { resolve: () => {}, reject: () => {} };
  const promise = new Promise<void>((resolve, reject) => {
    completion = { resolve, reject };
  });
  return { promise, completion };
}

describe("AddonInstallService", () => {
  let installation: WowInstallation;
  let provider: jasmine.SpyObj<AddonProvider>;

  let warcraftInstallationService: jasmine.SpyObj<WarcraftInstallationService>;
  let addonProviderFactory: jasmine.SpyObj<AddonProviderFactory>;
  let warcraftService: jasmine.SpyObj<WarcraftService>;
  let downloadService: jasmine.SpyObj<DownloadService>;
  let fileService: jasmine.SpyObj<FileService>;
  let tocService: jasmine.SpyObj<TocService>;
  let addonStorage: jasmine.SpyObj<AddonStorageService>;
  let analyticsService: jasmine.SpyObj<AnalyticsService>;

  let service: AddonInstallService;

  function createAddon(overrides: Partial<Addon> = {}): Addon {
    return {
      id: "addon-1",
      name: "Baganator",
      providerName: "Curse",
      externalId: "1001",
      externalLatestReleaseId: "5001",
      latestVersion: "1.2.0",
      installedVersion: "1.1.0",
      downloadUrl: "https://example.test/baganator.zip",
      clientType: WowClientType.Retail,
      channelType: AddonChannelType.Stable,
      installationId: installation.id,
      installedFolderList: [],
      // Already holding its own external id keeps backfillAddon from parsing tocs
      externalIds: [{ id: "1001", providerName: "Curse" }],
      isIgnored: false,
      autoUpdateEnabled: false,
      autoUpdateNotificationsEnabled: false,
      screenshotUrls: [],
      ...overrides,
    } as Addon;
  }

  /** Runs one item through the install queue and waits for it to settle. */
  async function runInstall(
    addon: Addon,
    installType: InstallType = "install",
    onUpdate = jasmine.createSpy("onUpdate"),
    originalAddon?: Addon,
  ): Promise<{ result: Promise<void>; onUpdate: jasmine.Spy }> {
    const deferred = createDeferred();
    const item: InstallQueueItem = {
      addon,
      onUpdate,
      completion: deferred.completion,
      installType,
      originalAddon,
    };
    service.enqueue(item);
    // Settle without letting a rejection escape the helper, callers assert on it
    await deferred.promise.catch(() => undefined);
    return { result: deferred.promise, onUpdate };
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
      defaultAutoUpdate: false,
    };

    provider = jasmine.createSpyObj<AddonProvider>("AddonProvider", ["getDownloadAuth", "isValidAddonId"]);
    provider.getDownloadAuth.and.resolveTo(undefined);
    provider.isValidAddonId.and.returnValue(true);
    (provider as { name: string }).name = "Curse";
    (provider as { forceIgnore: boolean }).forceIgnore = false;

    warcraftInstallationService = jasmine.createSpyObj<WarcraftInstallationService>("WarcraftInstallationService", [
      "getWowInstallation",
    ]);
    warcraftInstallationService.getWowInstallation.and.callFake((id) =>
      id === installation.id ? installation : undefined,
    );

    addonProviderFactory = jasmine.createSpyObj<AddonProviderFactory>("AddonProviderFactory", ["getProvider"]);
    addonProviderFactory.getProvider.and.callFake(((name: string) => (name === "Curse" ? provider : undefined)) as any);

    warcraftService = jasmine.createSpyObj<WarcraftService>("WarcraftService", ["getAddonFolderPath"]);
    warcraftService.getAddonFolderPath.and.returnValue(ADDON_FOLDER_PATH);

    downloadService = jasmine.createSpyObj<DownloadService>("DownloadService", ["downloadZipFile"]);
    downloadService.downloadZipFile.and.resolveTo(DOWNLOADED_ZIP_PATH);

    fileService = jasmine.createSpyObj<FileService>("FileService", [
      "unzipFile",
      "listDirectories",
      "removeAllSafe",
      "pathExists",
      "remove",
      "deleteIfExists",
      "createDirectory",
      "copy",
    ]);
    fileService.unzipFile.and.resolveTo(UNZIPPED_PATH);
    fileService.listDirectories.and.resolveTo(["Baganator"]);
    fileService.removeAllSafe.and.resolveTo(true);
    fileService.pathExists.and.resolveTo(false);
    fileService.remove.and.resolveTo(true);
    fileService.deleteIfExists.and.resolveTo();
    fileService.createDirectory.and.resolveTo(true);
    fileService.copy.and.resolveTo(true as any);

    tocService = jasmine.createSpyObj<TocService>("TocService", ["getAllTocs", "parse"]);
    tocService.getAllTocs.and.resolveTo([]);

    addonStorage = jasmine.createSpyObj<AddonStorageService>("AddonStorageService", [
      "setAsync",
      "removeAsync",
      "getAllForInstallationIdAsync",
      "getByExternalIdAsync",
    ]);
    addonStorage.setAsync.and.resolveTo();
    addonStorage.removeAsync.and.resolveTo();
    addonStorage.getAllForInstallationIdAsync.and.resolveTo([]);
    addonStorage.getByExternalIdAsync.and.resolveTo(undefined);

    analyticsService = jasmine.createSpyObj<AnalyticsService>("AnalyticsService", ["trackAction"]);

    service = new AddonInstallService(
      warcraftInstallationService,
      addonProviderFactory,
      { applicationDownloadsFolderPath: DOWNLOADS_FOLDER_PATH } as WowUpService,
      warcraftService,
      downloadService,
      fileService,
      tocService,
      addonStorage,
      analyticsService,
    );
  });

  describe("install queue", () => {
    it("should download, unzip and copy the addon into the AddOns folder", async () => {
      const addon = createAddon();

      const { result } = await runInstall(addon);

      await expectAsync(result).toBeResolved();
      expect(downloadService.downloadZipFile).toHaveBeenCalledWith(
        jasmine.objectContaining({
          fileName: "baganator.zip",
          outputFolder: DOWNLOADS_FOLDER_PATH,
          url: addon.downloadUrl,
        }),
      );
      expect(fileService.unzipFile).toHaveBeenCalledWith(DOWNLOADED_ZIP_PATH, jasmine.any(String));
      expect(fileService.copy).toHaveBeenCalledWith(
        pathJoin(UNZIPPED_PATH, "Baganator"),
        pathJoin(ADDON_FOLDER_PATH, "Baganator"),
      );
    });

    it("should mark the addon installed and save it", async () => {
      const addon = createAddon();

      await runInstall(addon);

      expect(addon.installedVersion).toEqual("1.2.0");
      expect(addon.installedExternalReleaseId).toEqual("5001");
      expect(addon.installedFolderList).toEqual(["Baganator"]);
      expect(addon.installedFolders).toEqual("Baganator");
      expect(addon.installedAt).toEqual(jasmine.any(Date));
      expect(addonStorage.setAsync).toHaveBeenCalledWith(addon.id, addon);
    });

    it("should keep the addon's dependency list when saving it", async () => {
      const dependencies = [
        { externalAddonId: "2002", type: AddonDependencyType.Required },
        { externalAddonId: "3003", type: AddonDependencyType.Optional },
      ];
      const addon = createAddon({ dependencies: [...dependencies] });

      await runInstall(addon);

      const saved = addonStorage.setAsync.calls.mostRecent().args[1];
      expect(saved.dependencies).toEqual(dependencies);
    });

    it("should skip ignored folders like __MACOSX", async () => {
      fileService.listDirectories.and.resolveTo(["Baganator", "__MACOSX"]);
      const addon = createAddon();

      await runInstall(addon);

      expect(fileService.copy).not.toHaveBeenCalledWith(jasmine.stringContaining("__MACOSX"), jasmine.any(String));
      expect(addon.installedFolderList).toEqual(["Baganator"]);
    });

    it("should report progress through onUpdate and addonInstalled$ in order", async () => {
      const events: AddonUpdateEvent[] = [];
      service.addonInstalled$.subscribe((e) => events.push(e));

      const { onUpdate } = await runInstall(createAddon());

      const expectedStates = [
        AddonInstallState.Downloading,
        AddonInstallState.BackingUp,
        AddonInstallState.Installing,
        AddonInstallState.Complete,
      ];
      expect(onUpdate.calls.allArgs().map((args) => args[0])).toEqual(expectedStates);
      expect(events.map((e) => e.installState)).toEqual(expectedStates);
      expect(events[events.length - 1].progress).toEqual(100);
    });

    it("should track the install type in analytics", async () => {
      await runInstall(createAddon(), "update");

      expect(analyticsService.trackAction).toHaveBeenCalledWith(
        USER_ACTION_ADDON_INSTALL,
        jasmine.objectContaining({ addonId: "1001", provider: "Curse", installType: "update" }),
      );
    });

    it("should remove the downloaded zip and unzipped folder afterwards", async () => {
      fileService.pathExists.and.callFake((p) => Promise.resolve(p === DOWNLOADED_ZIP_PATH || p === UNZIPPED_PATH));

      await runInstall(createAddon());

      expect(fileService.remove).toHaveBeenCalledWith(DOWNLOADED_ZIP_PATH);
      expect(fileService.remove).toHaveBeenCalledWith(UNZIPPED_PATH);
    });

    it("should back up the existing folders before replacing them on update", async () => {
      const currentPath = pathJoin(ADDON_FOLDER_PATH, "Baganator");
      const backupPath = pathJoin(ADDON_FOLDER_PATH, "Baganator-bak");
      fileService.pathExists.and.callFake((p) => Promise.resolve(p === currentPath));
      const addon = createAddon({ installedFolderList: ["Baganator"] });

      const { result } = await runInstall(addon, "update");

      await expectAsync(result).toBeResolved();
      expect(fileService.copy).toHaveBeenCalledWith(currentPath, backupPath);
      expect(fileService.removeAllSafe).toHaveBeenCalledWith(backupPath);
    });

    it("should restore the backup, reject and report an error when unzipping fails", async () => {
      const currentPath = pathJoin(ADDON_FOLDER_PATH, "Baganator");
      const backupPath = pathJoin(ADDON_FOLDER_PATH, "Baganator-bak");
      let backedUp = false;
      fileService.copy.and.callFake(((src: string) => {
        if (src === currentPath) {
          backedUp = true;
        }
        return Promise.resolve(true);
      }) as any);
      fileService.pathExists.and.callFake((p) =>
        Promise.resolve(p === currentPath ? !backedUp : p === backupPath && backedUp),
      );
      fileService.unzipFile.and.rejectWith(new Error("bad zip"));
      const events: AddonUpdateEvent[] = [];
      service.addonInstalled$.subscribe((e) => events.push(e));
      const addon = createAddon({ installedFolderList: ["Baganator"] });

      const { result, onUpdate } = await runInstall(addon, "update");

      await expectAsync(result).toBeRejectedWithError("bad zip");
      expect(fileService.copy).toHaveBeenCalledWith(backupPath, currentPath);
      expect(onUpdate).toHaveBeenCalledWith(AddonInstallState.Error, 100);
      expect(events[events.length - 1].installState).toEqual(AddonInstallState.Error);
      expect(addon.installedVersion).toEqual("1.1.0");
      expect(addonStorage.setAsync).not.toHaveBeenCalled();
    });

    it("should keep processing later items after an install fails", async () => {
      fileService.unzipFile.and.returnValues(Promise.reject(new Error("bad zip")), Promise.resolve(UNZIPPED_PATH));

      const first = await runInstall(createAddon({ id: "addon-1" }));
      const second = await runInstall(createAddon({ id: "addon-2", name: "Syndicator" }));

      await expectAsync(first.result).toBeRejected();
      await expectAsync(second.result).toBeResolved();
    });

    it("should run at most three installs at the same time", async () => {
      const pending: Array<() => void> = [];
      downloadService.downloadZipFile.and.callFake(
        () => new Promise<string>((resolve) => pending.push(() => resolve(DOWNLOADED_ZIP_PATH))),
      );

      const deferreds = [1, 2, 3, 4].map((i) => {
        const deferred = createDeferred();
        service.enqueue({
          addon: createAddon({ id: `addon-${i}`, name: `Addon ${i}` }),
          onUpdate: () => {},
          completion: deferred.completion,
          installType: "install",
        });
        return deferred;
      });

      await new Promise((r) => setTimeout(r));
      expect(downloadService.downloadZipFile).toHaveBeenCalledTimes(3);

      pending.shift()?.();
      await deferreds[0].promise;
      await new Promise((r) => setTimeout(r));
      expect(downloadService.downloadZipFile).toHaveBeenCalledTimes(4);

      pending.forEach((resolve) => resolve());
      await Promise.all(deferreds.map((d) => d.promise));
    });

    it("should reject and report an error when the installation is missing", async () => {
      const events: AddonUpdateEvent[] = [];
      service.addonInstalled$.subscribe((e) => events.push(e));

      const { result, onUpdate } = await runInstall(createAddon({ installationId: "missing" }));

      await expectAsync(result).toBeRejectedWithError(/Installation not found/);
      expect(onUpdate).toHaveBeenCalledWith(AddonInstallState.Error, 100);
      expect(events.map((e) => e.installState)).toEqual([AddonInstallState.Error]);
      expect(downloadService.downloadZipFile).not.toHaveBeenCalled();
    });

    it("should reject and report an error when the provider is missing", async () => {
      const { result, onUpdate } = await runInstall(createAddon({ providerName: "Nope" }));

      await expectAsync(result).toBeRejectedWithError(/Addon provider not found/);
      expect(onUpdate).toHaveBeenCalledWith(AddonInstallState.Error, 100);
      expect(downloadService.downloadZipFile).not.toHaveBeenCalled();
    });

    // Regression: these used to throw outside the try block, which ended the queue subscription
    it("should keep processing later items after an installation or provider lookup fails", async () => {
      const missingInstall = await runInstall(createAddon({ id: "addon-1", installationId: "missing" }));
      const missingProvider = await runInstall(createAddon({ id: "addon-2", providerName: "Nope" }));
      const valid = await runInstall(createAddon({ id: "addon-3" }));

      await expectAsync(missingInstall.result).toBeRejected();
      await expectAsync(missingProvider.result).toBeRejected();
      await expectAsync(valid.result).toBeResolved();
    });

    it("should report an error escaping the install and keep going", async () => {
      const errors: Error[] = [];
      service.installError$.subscribe((e) => errors.push(e));
      // The cleanup in the finally block runs outside the catch, so a throw there escapes processInstallQueue
      fileService.pathExists.and.returnValues(Promise.reject(new Error("disk gone")), Promise.resolve(false));

      await runInstall(createAddon({ id: "addon-1" }));
      await new Promise((r) => setTimeout(r));
      const second = await runInstall(createAddon({ id: "addon-2" }));

      expect(errors.map((e) => e.message)).toEqual(["disk gone"]);
      await expectAsync(second.result).toBeResolved();
    });

    it("should carry external ids over from the original addon", async () => {
      const original = createAddon({
        id: "old",
        externalIds: [{ id: "abc", providerName: "Wago" }],
      });
      addonProviderFactory.getProvider.and.returnValue(provider);
      const addon = createAddon({ externalIds: [{ id: "1001", providerName: "Curse" }] });

      await runInstall(addon, "update", jasmine.createSpy("onUpdate"), original);

      expect(addon.externalIds).toContain({ id: "abc", providerName: "Wago" });
    });
  });

  describe("removeAddon", () => {
    it("should delete the addon folders and remove it from storage", async () => {
      const addon = createAddon({ installedFolderList: ["Baganator", "Baganator_Options"] });

      await service.removeAddon(addon);

      expect(fileService.deleteIfExists).toHaveBeenCalledWith(pathJoin(ADDON_FOLDER_PATH, "Baganator"));
      expect(fileService.deleteIfExists).toHaveBeenCalledWith(pathJoin(ADDON_FOLDER_PATH, "Baganator_Options"));
      expect(addonStorage.removeAsync).toHaveBeenCalledWith(addon);
    });

    it("should not remove dependencies unless asked", async () => {
      const addon = createAddon({
        dependencies: [{ externalAddonId: "2002", type: AddonDependencyType.Required }],
      });

      await service.removeAddon(addon);

      expect(addonStorage.getByExternalIdAsync).not.toHaveBeenCalled();
    });

    it("should remove installed dependencies when asked", async () => {
      const dependency = createAddon({ id: "dep-1", name: "Syndicator", externalId: "2002" });
      addonStorage.getByExternalIdAsync.and.callFake((externalId) =>
        Promise.resolve(externalId === "2002" ? dependency : undefined),
      );
      const addon = createAddon({
        dependencies: [
          { externalAddonId: "2002", type: AddonDependencyType.Required },
          { externalAddonId: "9999", type: AddonDependencyType.Required },
        ],
      });

      await service.removeAddon(addon, true);

      expect(addonStorage.getByExternalIdAsync).toHaveBeenCalledWith("2002", "Curse", installation.id);
      expect(addonStorage.getByExternalIdAsync).toHaveBeenCalledWith("9999", "Curse", installation.id);
      expect(addonStorage.removeAsync).toHaveBeenCalledWith(dependency);
      expect(addonStorage.removeAsync).toHaveBeenCalledTimes(2);
    });

    it("should throw when every folder fails to delete", async () => {
      fileService.deleteIfExists.and.rejectWith(new Error("locked"));
      const addon = createAddon({ installedFolderList: ["Baganator"] });

      await expectAsync(service.removeAddon(addon)).toBeRejectedWithError("Failed to remove all directories");
      expect(addonStorage.removeAsync).not.toHaveBeenCalled();
    });
  });

  describe("getByExternalId", () => {
    it("should look the addon up in storage", async () => {
      const addon = createAddon();
      addonStorage.getByExternalIdAsync.and.resolveTo(addon);

      const result = await service.getByExternalId("1001", "Curse", installation.id);

      expect(result).toBe(addon);
      expect(addonStorage.getByExternalIdAsync).toHaveBeenCalledWith("1001", "Curse", installation.id);
    });
  });
});
