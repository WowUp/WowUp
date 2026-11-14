/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { EMPTY, Subject } from "rxjs";
import { AddonChannelType, AddonFolder, Toc, WowClientType, WowInstallation } from "wowup-lib-core";

import { ElectronService } from "../services";
import { CachingService } from "../services/caching/caching-service";
import { NetworkService } from "../services/network/network.service";
import { SensitiveStorageService } from "../services/storage/sensitive-storage.service";
import { TocService } from "../services/toc/toc.service";
import { UiMessageService } from "../services/ui-message/ui-message.service";
import { WarcraftService } from "../services/warcraft/warcraft.service";
import { WagoAddonProvider } from "./wago-addon-provider";

/** Every client Wago serves, the scan must behave the same for each of them */
const CLIENT_TYPES = Object.values(WowClientType).filter((value): value is WowClientType => {
  if (typeof value !== "number") {
    return false;
  }
  try {
    (WagoAddonProvider.prototype as any).getGameVersion(value);
    return true;
  } catch {
    return false;
  }
});

describe("WagoAddonProvider", () => {
  for (const clientType of CLIENT_TYPES) {
    describe(`scan (${WowClientType[clientType]})`, () => {
      const installation = { id: "inst", clientType } as WowInstallation;
      defineScanSpecs(installation);
    });
  }
});

function defineScanSpecs(installation: WowInstallation): void {
  const tocs = new Map<string, Toc>();

  let provider: WagoAddonProvider;
  let sendMatchesRequest: jasmine.Spy;
  let getRecents: jasmine.Spy;

  function folder(name: string, toc: Partial<Toc>): AddonFolder {
    tocs.set(name, { fileName: `${name}.toc`, filePath: "", interface: [], dependencyList: [], ...toc });
    return { name, tocs: [], wowUpScanResults: { folderName: name, fingerprint: `hash-${name}` } } as AddonFolder;
  }

  beforeEach(() => {
    tocs.clear();

    const electronService = jasmine.createSpyObj<ElectronService>("ElectronService", ["on"], {
      powerMonitor$: EMPTY,
    });
    const sensitiveStorageService = jasmine.createSpyObj<SensitiveStorageService>(
      "SensitiveStorageService",
      ["getAsync"],
      { change$: new Subject<any>() },
    );
    sensitiveStorageService.getAsync.and.resolveTo(undefined);
    const networkService = jasmine.createSpyObj<NetworkService>("NetworkService", ["getCircuitBreaker"]);
    networkService.getCircuitBreaker.and.returnValue({} as any);
    const tocService = jasmine.createSpyObj<TocService>("TocService", ["getTocForGameType2"]);
    tocService.getTocForGameType2.and.callFake((name: string) => tocs.get(name));

    provider = new WagoAddonProvider(
      electronService,
      {} as CachingService,
      {} as WarcraftService,
      tocService,
      {} as UiMessageService,
      sensitiveStorageService,
      networkService,
    );

    sendMatchesRequest = spyOn(provider as any, "sendMatchesRequest").and.resolveTo({ addons: [] });
    getRecents = spyOn(provider as any, "getRecents").and.resolveTo({ addons: {} });
  });

  it("matches a folder without a fingerprint match through its X-Wago-ID", async () => {
    const addonFolder = folder("AddonA", { wagoAddonId: "abcdefgh", version: "3.1.0" });
    getRecents.and.resolveTo({
      addons: {
        abcdefgh: {
          id: "abcdefgh",
          name: "AddonA",
          thumbnail: "",
          website_url: "https://addons.wago.io/addons/addon-a",
          authors: ["author-a"],
          recent_releases: {
            stable: { id: "r2", label: "v3.2.0", created_at: "2026-01-02", patch: "", supported_patches: [] },
          },
        },
      },
    });

    await provider.scan(installation, AddonChannelType.Stable, [addonFolder]);

    expect(sendMatchesRequest).toHaveBeenCalled();
    expect(getRecents).toHaveBeenCalledOnceWith(installation, ["abcdefgh"]);
    expect(addonFolder.matchingAddon).toEqual(
      jasmine.objectContaining({
        externalId: "abcdefgh",
        providerName: provider.name,
        installedVersion: "3.1.0",
        installedExternalReleaseId: undefined,
        latestVersion: "v3.2.0",
        installedFolderList: ["AddonA"],
      }),
    );
  });

  it("leaves a shipped folder with other files to its own match", async () => {
    const addonA = folder("AddonA", {});
    const addonData = folder("AddonA_Data", { version: "1.0.1" });
    sendMatchesRequest.and.resolveTo({
      addons: [
        {
          id: "aBcD1234",
          name: "AddonA",
          thumbnail: "",
          website_url: "",
          matched_release: { id: "r1", label: "v3.1.0", created_at: "2026-01-01", patch: "", supported_patches: [] },
          // The release bundles another AddonA_Data than the installed one
          modules: { AddonA: { hash: "hash-AddonA" }, AddonA_Data: { hash: "hash-older" } },
          recent_releases: {
            stable: { id: "r1", label: "v3.1.0", created_at: "2026-01-01", patch: "", supported_patches: [] },
          },
        },
      ],
    });

    await provider.scan(installation, AddonChannelType.Stable, [addonA, addonData]);

    expect(addonA.matchingAddon?.installedFolderList).toEqual(["AddonA"]);
    expect(addonA.matchingAddon?.installedFolders).toBe("AddonA");
    expect(addonData.matchingAddon).toBeUndefined();
  });

  it("does not look up folders without a valid X-Wago-ID", async () => {
    const addonFolder = folder("Local", { wagoAddonId: "x" });

    await provider.scan(installation, AddonChannelType.Stable, [addonFolder]);

    expect(getRecents).not.toHaveBeenCalled();
    expect(addonFolder.matchingAddon).toBeUndefined();
  });
}
