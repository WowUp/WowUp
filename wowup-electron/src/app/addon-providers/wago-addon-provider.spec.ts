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

describe("WagoAddonProvider", () => {
  const installation = { id: "inst", clientType: WowClientType.Forever } as WowInstallation;
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
    const addonFolder = folder("Questie", { wagoAddonId: "abcdefgh", version: "12.6.4" });
    getRecents.and.resolveTo({
      addons: {
        abcdefgh: {
          id: "abcdefgh",
          name: "Questie",
          thumbnail: "",
          website_url: "https://addons.wago.io/addons/questie",
          authors: ["Aero"],
          recent_releases: {
            stable: { id: "r2", label: "v12.6.5", created_at: "2026-11-02", patch: "", supported_patches: [] },
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
        installedVersion: "12.6.4",
        installedExternalReleaseId: undefined,
        latestVersion: "v12.6.5",
        installedFolderList: ["Questie"],
      }),
    );
  });

  it("does not look up folders without a valid X-Wago-ID", async () => {
    const addonFolder = folder("Local", { wagoAddonId: "x" });

    await provider.scan(installation, AddonChannelType.Stable, [addonFolder]);

    expect(getRecents).not.toHaveBeenCalled();
    expect(addonFolder.matchingAddon).toBeUndefined();
  });
});
