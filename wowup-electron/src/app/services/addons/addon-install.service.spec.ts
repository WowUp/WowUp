/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-argument */
import { basename, join as pathJoin } from "path";
import {
  Addon,
  AddonChannelType,
  AddonDependencyType,
  AddonProvider,
  AddonScanResult,
  WowClientType,
  WowInstallation,
  WowUpAddonProvider,
} from "wowup-lib-core";

import { USER_ACTION_ADDON_INSTALL } from "../../../common/constants";
import { InstallAddonFileRequest, InstalledAddonFile } from "../../../common/models/addon-install";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { AnalyticsService } from "../analytics/analytics.service";
import { AddonInstallApiService } from "../api/addon-install-api.service";
import { AddonScanApiService } from "../api/addon-scan-api.service";
import { DownloadService } from "../download/download.service";
import { FileService } from "../files/file.service";
import { WarcraftInstallationService } from "../warcraft/warcraft-installation.service";
import { WarcraftService } from "../warcraft/warcraft.service";
import { WowUpService } from "../wowup/wowup.service";
import { AddonInstallService, InstallQueueItem, InstallType } from "./addon-install.service";
import { AddonProviderFactory } from "./addon.provider.factory";

const ADDON_FOLDER_PATH = pathJoin("wow", "_retail_", "Interface", "AddOns");
const DOWNLOADS_FOLDER_PATH = pathJoin("wowup", "downloads");
const DOWNLOADED_ZIP_PATH = pathJoin(DOWNLOADS_FOLDER_PATH, "baganator.zip");

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

/** What main hands back for a good install: the addon marked installed, plus the original's ids */
function fakeInstalled(request: InstallAddonFileRequest): InstalledAddonFile {
  const externalIds = [...(request.addon.externalIds ?? [])];
  for (const extId of request.originalAddon?.externalIds ?? []) {
    if (!externalIds.some((e) => e.id === extId.id && e.providerName === extId.providerName)) {
      externalIds.push(extId);
    }
  }
  return {
    addon: {
      ...request.addon,
      installedVersion: request.addon.latestVersion,
      installedFolderList: ["Baganator"],
      installedFolders: "Baganator",
      isIgnored: request.forceIgnore,
      externalIds,
    },
    removedAddons: [],
  };
}

describe("AddonInstallService", () => {
  let installation: WowInstallation;
  let provider: jasmine.SpyObj<AddonProvider>;

  let warcraftInstallationService: jasmine.SpyObj<WarcraftInstallationService>;
  let addonProviderFactory: jasmine.SpyObj<AddonProviderFactory>;
  let warcraftService: jasmine.SpyObj<WarcraftService>;
  let downloadService: jasmine.SpyObj<DownloadService>;
  let fileService: jasmine.SpyObj<FileService>;
  let analyticsService: jasmine.SpyObj<AnalyticsService>;
  let addonScanApiService: jasmine.SpyObj<AddonScanApiService>;
  let installApi: jasmine.SpyObj<AddonInstallApiService>;
  let hubProvider: jasmine.SpyObj<WowUpAddonProvider>;

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

    addonProviderFactory = jasmine.createSpyObj<AddonProviderFactory>("AddonProviderFactory", [
      "getProvider",
      "getProviderNames",
    ]);
    addonProviderFactory.getProvider.and.callFake(((name: string) => (name === "Curse" ? provider : undefined)) as any);
    addonProviderFactory.getProviderNames.and.returnValue(["Curse", "Wago", "WowUpHub"]);

    warcraftService = jasmine.createSpyObj<WarcraftService>("WarcraftService", ["getAddonFolderPath"]);
    warcraftService.getAddonFolderPath.and.returnValue(ADDON_FOLDER_PATH);

    downloadService = jasmine.createSpyObj<DownloadService>("DownloadService", ["downloadZipFile"]);
    downloadService.downloadZipFile.and.resolveTo(DOWNLOADED_ZIP_PATH);

    fileService = jasmine.createSpyObj<FileService>("FileService", ["pathExists", "remove"]);
    fileService.pathExists.and.resolveTo(false);
    fileService.remove.and.resolveTo(true);

    analyticsService = jasmine.createSpyObj<AnalyticsService>("AnalyticsService", ["trackAction"]);

    addonScanApiService = jasmine.createSpyObj<AddonScanApiService>("AddonScanApiService", ["getScanResults"]);
    addonScanApiService.getScanResults.and.callFake((filePaths) =>
      Promise.resolve(
        filePaths.map((path) => ({
          path,
          wowup: { fingerprint: `fp-${basename(path)}` } as AddonScanResult,
        })),
      ),
    );

    installApi = jasmine.createSpyObj<AddonInstallApiService>("AddonInstallApiService", [
      "installFile",
      "addExternalId",
    ]);
    installApi.addExternalId.and.callFake((request) =>
      Promise.resolve([
        { id: "1001", providerName: "Curse" },
        { id: request.externalId, providerName: request.providerName },
      ]),
    );
    installApi.installFile.and.callFake((request, onPhase) => {
      onPhase("backingUp");
      onPhase("installing");
      return Promise.resolve(fakeInstalled(request));
    });

    hubProvider = jasmine.createSpyObj<WowUpAddonProvider>("WowUpAddonProvider", ["getAddonIdsByFingerprints"]);
    hubProvider.getAddonIdsByFingerprints.and.resolveTo(new Map());
    (hubProvider as { enabled: boolean }).enabled = true;

    service = new AddonInstallService(
      warcraftInstallationService,
      addonProviderFactory,
      { applicationDownloadsFolderPath: DOWNLOADS_FOLDER_PATH } as WowUpService,
      warcraftService,
      downloadService,
      fileService,
      analyticsService,
      addonScanApiService,
      installApi,
    );
  });

  describe("install queue", () => {
    it("should download the addon and hand the zip to main", async () => {
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
      expect(installApi.installFile).toHaveBeenCalledWith(
        {
          addon,
          zipFilePath: DOWNLOADED_ZIP_PATH,
          originalAddon: undefined,
          forceIgnore: false,
          providerNames: ["Curse", "Wago", "WowUpHub"],
        },
        jasmine.any(Function),
      );
    });

    it("should pass the provider's forceIgnore and the original addon to main", async () => {
      (provider as { forceIgnore: boolean }).forceIgnore = true;
      const original = createAddon({ id: "old", providerName: "Wago" });

      await runInstall(createAddon(), "install", jasmine.createSpy("onUpdate"), original);

      const request = installApi.installFile.calls.mostRecent().args[0];
      expect(request.forceIgnore).toBeTrue();
      expect(request.originalAddon).toEqual(original);
    });

    it("should copy main's saved addon onto the queued addon object", async () => {
      const addon = createAddon();

      await runInstall(addon);

      expect(addon.installedVersion).toEqual("1.2.0");
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
      expect(onUpdate.calls.allArgs().map((args) => args[1])).toEqual([25, 50, 75, 100]);
      expect(events.map((e) => e.installState)).toEqual([AddonInstallState.Pending, ...expectedStates]);
    });

    it("should track the install type in analytics", async () => {
      await runInstall(createAddon(), "update");

      expect(analyticsService.trackAction).toHaveBeenCalledWith(
        USER_ACTION_ADDON_INSTALL,
        jasmine.objectContaining({ addonId: "1001", provider: "Curse", installType: "update" }),
      );
    });

    it("should track the unknown addons main dropped as removed", async () => {
      installApi.installFile.and.callFake((request) =>
        Promise.resolve({
          ...fakeInstalled(request),
          removedAddons: [createAddon({ id: "unknown-1", name: "Baganator", providerName: "Unknown" })],
        }),
      );

      await runInstall(createAddon());

      expect(analyticsService.trackAction).toHaveBeenCalledWith(
        USER_ACTION_ADDON_INSTALL,
        jasmine.objectContaining({ provider: "Unknown", installType: "remove" }),
      );
    });

    // Waits out the real one second backoff before the second attempt
    it("should retry a failed download after letting the caller refresh the addon", async () => {
      downloadService.downloadZipFile.and.returnValues(
        Promise.reject(new Error("403")),
        Promise.resolve(DOWNLOADED_ZIP_PATH),
      );

      const { result, onUpdate } = await runInstall(createAddon());

      await expectAsync(result).toBeResolved();
      expect(onUpdate).toHaveBeenCalledWith(AddonInstallState.Retry, 0);
      expect(downloadService.downloadZipFile).toHaveBeenCalledTimes(2);
      expect(installApi.installFile).toHaveBeenCalledTimes(1);
    });

    it("should reject and report an error when main's install fails", async () => {
      installApi.installFile.and.rejectWith(new Error("bad zip"));
      const events: AddonUpdateEvent[] = [];
      service.addonInstalled$.subscribe((e) => events.push(e));
      const addon = createAddon({ installedFolderList: ["Baganator"] });

      const { result, onUpdate } = await runInstall(addon, "update");

      await expectAsync(result).toBeRejectedWithError("bad zip");
      expect(onUpdate).toHaveBeenCalledWith(AddonInstallState.Error, 100);
      expect(events[events.length - 1].installState).toEqual(AddonInstallState.Error);
      expect(addon.installedVersion).toEqual("1.1.0");
    });

    it("should remove the zip itself when main never got to it", async () => {
      installApi.installFile.and.rejectWith(new Error("ipc down"));
      fileService.pathExists.and.callFake((p) => Promise.resolve(p === DOWNLOADED_ZIP_PATH));

      await runInstall(createAddon());

      expect(fileService.remove).toHaveBeenCalledWith(DOWNLOADED_ZIP_PATH);
    });

    it("should keep processing later items after an install fails", async () => {
      installApi.installFile.and.returnValues(
        Promise.reject(new Error("bad zip")),
        Promise.resolve(fakeInstalled({ addon: createAddon({ id: "addon-2" }) } as InstallAddonFileRequest)),
      );

      const first = await runInstall(createAddon({ id: "addon-1" }));
      const second = await runInstall(createAddon({ id: "addon-2", name: "Syndicator" }));

      await expectAsync(first.result).toBeRejected();
      await expectAsync(second.result).toBeResolved();
    });

    it("should report items waiting for a free slot as pending", async () => {
      const pending: Array<() => void> = [];
      downloadService.downloadZipFile.and.callFake(
        () => new Promise<string>((resolve) => pending.push(() => resolve(DOWNLOADED_ZIP_PATH))),
      );
      const events: AddonUpdateEvent[] = [];
      service.addonInstalled$.subscribe((e) => events.push(e));

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
      const statesOf = (id: string) => events.filter((e) => e.addon.id === id).map((e) => e.installState);
      expect(statesOf("addon-1")).toEqual([AddonInstallState.Pending, AddonInstallState.Downloading]);
      expect(statesOf("addon-4")).toEqual([AddonInstallState.Pending]);

      pending.forEach((resolve) => resolve());
      await deferreds[0].promise;
      await new Promise((r) => setTimeout(r));
      pending.forEach((resolve) => resolve());
      await Promise.all(deferreds.map((d) => d.promise));
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
      expect(events.map((e) => e.installState)).toEqual([AddonInstallState.Pending, AddonInstallState.Error]);
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
  });

  describe("hub external id", () => {
    beforeEach(() => {
      addonProviderFactory.getProvider.and.callFake(((name: string) =>
        name === "Curse" ? provider : name === "WowUpHub" ? hubProvider : undefined) as any);
    });

    it("should add the hub id of an addon installed from another provider", async () => {
      hubProvider.getAddonIdsByFingerprints.and.resolveTo(new Map([["fp-Baganator", "50"]]));
      const addon = createAddon();

      const { result } = await runInstall(addon);

      await expectAsync(result).toBeResolved();
      expect(addonScanApiService.getScanResults).toHaveBeenCalledWith(
        [pathJoin(ADDON_FOLDER_PATH, "Baganator")],
        ["wowup"],
      );
      expect(hubProvider.getAddonIdsByFingerprints).toHaveBeenCalledWith(["fp-Baganator"]);
      expect(addon.externalIds).toContain({ id: "50", providerName: "WowUpHub" });
      expect(installApi.addExternalId).toHaveBeenCalledWith({
        addonId: addon.id,
        providerName: "WowUpHub",
        externalId: "50",
      });
    });

    it("should leave the external ids alone when the hub does not know the addon", async () => {
      const addon = createAddon();

      await runInstall(addon);

      expect(addon.externalIds).toEqual([{ id: "1001", providerName: "Curse" }]);
      expect(installApi.addExternalId).not.toHaveBeenCalled();
    });

    it("should still finish the install when the hub lookup fails", async () => {
      hubProvider.getAddonIdsByFingerprints.and.rejectWith(new Error("hub down"));
      spyOn(console, "error");
      const addon = createAddon();

      const { result, onUpdate } = await runInstall(addon);

      await expectAsync(result).toBeResolved();
      expect(onUpdate).toHaveBeenCalledWith(AddonInstallState.Complete, 100);
      expect(addon.externalIds?.some((extId) => extId.providerName === "WowUpHub")).toBeFalse();
    });

    it("should not ask the hub about an addon installed from the hub", async () => {
      const addon = createAddon({
        providerName: "WowUpHub",
        externalId: "50",
        externalIds: [{ id: "50", providerName: "WowUpHub" }],
      });
      addonProviderFactory.getProvider.and.callFake(((name: string) =>
        name === "WowUpHub" ? hubProvider : undefined) as any);

      await runInstall(addon);

      expect(hubProvider.getAddonIdsByFingerprints).not.toHaveBeenCalled();
    });

    it("should not ask the hub again when the hub id is already known", async () => {
      const original = createAddon({ id: "old", externalIds: [{ id: "50", providerName: "WowUpHub" }] });
      const addon = createAddon();

      await runInstall(addon, "update", jasmine.createSpy("onUpdate"), original);

      expect(hubProvider.getAddonIdsByFingerprints).not.toHaveBeenCalled();
      expect(addon.externalIds).toContain({ id: "50", providerName: "WowUpHub" });
    });

    it("should not ask the hub when the hub provider is turned off", async () => {
      (hubProvider as { enabled: boolean }).enabled = false;
      const addon = createAddon();

      await runInstall(addon);

      expect(addonScanApiService.getScanResults).not.toHaveBeenCalled();
      expect(hubProvider.getAddonIdsByFingerprints).not.toHaveBeenCalled();
    });
  });

  it("should keep the dependency list main saved", async () => {
    const dependencies = [{ externalAddonId: "2002", type: AddonDependencyType.Required }];
    const addon = createAddon({ dependencies: [...dependencies] });

    await runInstall(addon);

    expect(addon.dependencies).toEqual(dependencies);
  });
});
