/* eslint-disable @typescript-eslint/unbound-method */
import { Addon, AddonChannelType, AddonDependencyType, WowClientType } from "wowup-lib-core";

import { USER_ACTION_ADDON_INSTALL } from "../../../common/constants";
import { AddonInstallPhase, InstallAddonRequest, InstalledAddonFile } from "../../../common/models/addon-install";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { AnalyticsService } from "../analytics/analytics.service";
import { AddonInstallApiService } from "../api/addon-install-api.service";
import { AddonInstallService, InstallQueueItem, InstallType } from "./addon-install.service";

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

/** What main hands back for a good install: the addon marked installed */
function fakeInstalled(request: InstallAddonRequest): InstalledAddonFile {
  return {
    addon: {
      ...request.addon,
      installedVersion: request.addon.latestVersion,
      installedFolderList: ["Baganator"],
      installedFolders: "Baganator",
    },
    removedAddons: [],
  };
}

/** Main's phases for a good install, as it reports them */
function goodInstall(request: InstallAddonRequest, onPhase: (phase: AddonInstallPhase) => void) {
  onPhase("downloading");
  onPhase("backingUp");
  onPhase("installing");
  return Promise.resolve(fakeInstalled(request));
}

describe("AddonInstallService", () => {
  let analyticsService: jasmine.SpyObj<AnalyticsService>;
  let installApi: jasmine.SpyObj<AddonInstallApiService>;

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
      installationId: "install-1",
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

  /** Makes main's install hang until the returned functions are called, one per install */
  function holdInstalls(): Array<() => void> {
    const pending: Array<() => void> = [];
    installApi.install.and.callFake(
      (request) => new Promise<InstalledAddonFile>((resolve) => pending.push(() => resolve(fakeInstalled(request)))),
    );
    return pending;
  }

  function enqueueMany(count: number): Deferred[] {
    return Array.from({ length: count }, (_, i) => {
      const deferred = createDeferred();
      service.enqueue({
        addon: createAddon({ id: `addon-${i + 1}`, name: `Addon ${i + 1}` }),
        onUpdate: () => {},
        completion: deferred.completion,
        installType: "install",
      });
      return deferred;
    });
  }

  beforeEach(() => {
    analyticsService = jasmine.createSpyObj<AnalyticsService>("AnalyticsService", ["trackAction"]);
    installApi = jasmine.createSpyObj<AddonInstallApiService>("AddonInstallApiService", ["install"]);
    installApi.install.and.callFake(goodInstall);

    service = new AddonInstallService(analyticsService, installApi);
  });

  describe("install queue", () => {
    it("should hand the addon and the one it replaces to main", async () => {
      const addon = createAddon();
      const original = createAddon({ id: "old", providerName: "Wago" });

      const { result } = await runInstall(addon, "install", jasmine.createSpy("onUpdate"), original);

      await expectAsync(result).toBeResolved();
      expect(installApi.install).toHaveBeenCalledWith({ addon, originalAddon: original }, jasmine.any(Function));
    });

    it("should copy main's saved addon onto the queued addon object", async () => {
      const addon = createAddon();

      await runInstall(addon);

      expect(addon.installedVersion).toEqual("1.2.0");
      expect(addon.installedFolderList).toEqual(["Baganator"]);
    });

    it("should report main's phases through onUpdate and addonInstalled$ in order", async () => {
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

    it("should show a retry on the grids only, not to the caller", async () => {
      installApi.install.and.callFake((request, onPhase) => {
        onPhase("downloading");
        onPhase("retry");
        return goodInstall(request, onPhase);
      });
      const events: AddonUpdateEvent[] = [];
      service.addonInstalled$.subscribe((e) => events.push(e));

      const { onUpdate } = await runInstall(createAddon());

      expect(events.map((e) => e.installState)).toContain(AddonInstallState.Retry);
      expect(onUpdate).not.toHaveBeenCalledWith(AddonInstallState.Retry, jasmine.anything());
    });

    it("should track the install type in analytics", async () => {
      await runInstall(createAddon(), "update");

      expect(analyticsService.trackAction).toHaveBeenCalledWith(
        USER_ACTION_ADDON_INSTALL,
        jasmine.objectContaining({ addonId: "1001", provider: "Curse", installType: "update" }),
      );
    });

    it("should track the unknown addons main dropped as removed", async () => {
      installApi.install.and.callFake((request) =>
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

    it("should reject and report an error when main's install fails", async () => {
      installApi.install.and.rejectWith(new Error("bad zip"));
      const events: AddonUpdateEvent[] = [];
      service.addonInstalled$.subscribe((e) => events.push(e));
      const addon = createAddon({ installedFolderList: ["Baganator"] });

      const { result, onUpdate } = await runInstall(addon, "update");

      await expectAsync(result).toBeRejectedWithError("bad zip");
      expect(onUpdate).toHaveBeenCalledWith(AddonInstallState.Error, 100);
      expect(events[events.length - 1].installState).toEqual(AddonInstallState.Error);
      expect(addon.installedVersion).toEqual("1.1.0");
    });

    it("should keep processing later items after an install fails", async () => {
      installApi.install.and.returnValues(
        Promise.reject(new Error("bad zip")),
        Promise.resolve(fakeInstalled({ addon: createAddon({ id: "addon-2" }) })),
      );

      const first = await runInstall(createAddon({ id: "addon-1" }));
      const second = await runInstall(createAddon({ id: "addon-2", name: "Syndicator" }));

      await expectAsync(first.result).toBeRejected();
      await expectAsync(second.result).toBeResolved();
    });

    it("should report items waiting for a free slot as pending", async () => {
      const pending = holdInstalls();
      const events: AddonUpdateEvent[] = [];
      service.addonInstalled$.subscribe((e) => events.push(e));

      const deferreds = enqueueMany(4);

      await new Promise((r) => setTimeout(r));
      const statesOf = (id: string) => events.filter((e) => e.addon.id === id).map((e) => e.installState);
      expect(statesOf("addon-1")).toEqual([AddonInstallState.Pending]);
      expect(statesOf("addon-4")).toEqual([AddonInstallState.Pending]);
      expect(installApi.install).toHaveBeenCalledTimes(3);

      pending.forEach((resolve) => resolve());
      await deferreds[0].promise;
      await new Promise((r) => setTimeout(r));
      pending.forEach((resolve) => resolve());
      await Promise.all(deferreds.map((d) => d.promise));
    });

    it("should run at most three installs at the same time", async () => {
      const pending = holdInstalls();

      const deferreds = enqueueMany(4);

      await new Promise((r) => setTimeout(r));
      expect(installApi.install).toHaveBeenCalledTimes(3);

      pending.shift()?.();
      await deferreds[0].promise;
      await new Promise((r) => setTimeout(r));
      expect(installApi.install).toHaveBeenCalledTimes(4);

      pending.forEach((resolve) => resolve());
      await Promise.all(deferreds.map((d) => d.promise));
    });

    it("should report an error escaping the install and keep going", async () => {
      const errors: Error[] = [];
      service.installError$.subscribe((e) => errors.push(e));
      installApi.install.and.rejectWith(new Error("bad zip"));
      // A throw from the caller's callback in the error path escapes processInstallQueue
      const throwing = jasmine.createSpy("onUpdate").and.throwError(new Error("ui gone"));

      await runInstall(createAddon({ id: "addon-1" }), "install", throwing);
      await new Promise((r) => setTimeout(r));
      installApi.install.and.callFake(goodInstall);
      const second = await runInstall(createAddon({ id: "addon-2" }));

      expect(errors.map((e) => e.message)).toEqual(["ui gone"]);
      await expectAsync(second.result).toBeResolved();
    });
  });

  it("should keep the dependency list main saved", async () => {
    const dependencies = [{ externalAddonId: "2002", type: AddonDependencyType.Required }];
    const addon = createAddon({ dependencies: [...dependencies] });

    await runInstall(addon);

    expect(addon.dependencies).toEqual(dependencies);
  });
});
