/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-argument */
import * as cfv2 from "curseforge-v2";
import {
  AddonChannelType,
  AddonDependencyType,
  AddonFolder,
  AddonSearchResult,
  Toc,
  WowClientType,
  WowInstallation,
} from "wowup-lib-core";

import { CachingService } from "../services/caching/caching-service";
import { NetworkService } from "../services/network/network.service";
import { TocService } from "../services/toc/toc.service";
import { CurseAddonProvider } from "./curse-addon-provider";

describe("CurseAddonProvider", () => {
  let provider: CurseAddonProvider;

  function createFile(dependencies: cfv2.CF2FileDependency[]): cfv2.CF2File {
    return {
      id: 5001,
      displayName: "1.2.0",
      downloadUrl: "https://example.test/baganator.zip",
      fileDate: "2026-09-01T00:00:00Z",
      releaseType: cfv2.CF2FileReleaseType.Release,
      gameVersions: ["11.2.0"],
      modules: [{ name: "Baganator", fingerprint: 1 }],
      dependencies,
    } as unknown as cfv2.CF2File;
  }

  function createAddon(): cfv2.CF2Addon {
    return {
      id: 1001,
      name: "Baganator",
      summary: "",
      downloadCount: 100,
      authors: [{ name: "plusmouse" }],
      screenshots: [],
      links: { websiteUrl: "https://example.test/baganator" },
    } as unknown as cfv2.CF2Addon;
  }

  /** getAddonSearchResult is the single place every lookup (getById, search, featured) maps CF files through. */
  function toSearchResult(file: cfv2.CF2File): AddonSearchResult | undefined {
    return (provider as any).getAddonSearchResult(createAddon(), [file]);
  }

  beforeEach(() => {
    const networkService = jasmine.createSpyObj<NetworkService>("NetworkService", ["getCircuitBreaker"]);
    networkService.getCircuitBreaker.and.returnValue({} as any);

    provider = new CurseAddonProvider({} as CachingService, networkService, {} as TocService);
  });

  describe("dependency mapping", () => {
    it("should map each CurseForge relation type onto a WowUp dependency type", () => {
      const file = createFile([
        { modId: 1, fileId: 0, relationType: cfv2.CF2FileRelationType.RequiredDependency },
        { modId: 2, fileId: 0, relationType: cfv2.CF2FileRelationType.OptionalDependency },
        { modId: 3, fileId: 0, relationType: cfv2.CF2FileRelationType.EmbeddedLibrary },
        { modId: 4, fileId: 0, relationType: cfv2.CF2FileRelationType.Tool },
        { modId: 5, fileId: 0, relationType: cfv2.CF2FileRelationType.Incompatible },
        { modId: 6, fileId: 0, relationType: cfv2.CF2FileRelationType.Include },
      ]);

      const result = toSearchResult(file);

      expect(result?.files?.[0].dependencies).toEqual([
        { externalAddonId: "1", type: AddonDependencyType.Required },
        { externalAddonId: "2", type: AddonDependencyType.Optional },
        { externalAddonId: "3", type: AddonDependencyType.Embedded },
        { externalAddonId: "4", type: AddonDependencyType.Other },
        { externalAddonId: "5", type: AddonDependencyType.Other },
        { externalAddonId: "6", type: AddonDependencyType.Other },
      ]);
    });

    it("should leave the dependency list empty when the file has none", () => {
      const result = toSearchResult(createFile([]));

      expect(result?.files?.[0].dependencies).toEqual([]);
    });

    it("should keep the search result itself intact", () => {
      const result = toSearchResult(
        createFile([{ modId: 2002, fileId: 0, relationType: cfv2.CF2FileRelationType.RequiredDependency }]),
      );

      expect(result).toEqual(
        jasmine.objectContaining({
          externalId: "1001",
          name: "Baganator",
          providerName: provider.name,
        }),
      );
      expect(result?.files?.[0]).toEqual(
        jasmine.objectContaining({
          externalId: "5001",
          version: "1.2.0",
          folders: ["Baganator"],
        }),
      );
    });
  });

  /** Every client the provider knows, the scan must behave the same for each of them */
  const CLIENT_TYPES = Object.values(WowClientType).filter(
    (value): value is WowClientType => typeof value === "number" && value !== WowClientType.None,
  );
  /** A game version type of no client, for releases that are not tagged for the installation */
  const OTHER_CLIENT_TYPE_ID = 999_999;

  for (const clientType of CLIENT_TYPES) {
    describe(`scan (${WowClientType[clientType]})`, () => {
      const installation = { id: "inst", clientType } as WowInstallation;

      let client: jasmine.SpyObj<cfv2.CFV2Client>;
      let clientTypeId: number;

      function toc(folder: string, fields: Partial<Toc> = {}): Toc {
        return {
          fileName: `${folder}.toc`,
          filePath: `/AddOns/${folder}/${folder}.toc`,
          interface: ["10000"],
          dependencyList: [],
          ...fields,
        };
      }

      function folder(name: string, tocFields: Partial<Toc> = {}, fingerprint?: number): AddonFolder {
        return {
          name,
          path: `/AddOns/${name}`,
          status: "Pending",
          tocs: [toc(name, tocFields)],
          cfScanResults: fingerprint === undefined ? undefined : ({ fingerprintNum: fingerprint } as any),
        } as AddonFolder;
      }

      function cfFile(id: number, displayName: string, typeIds: number[], modules: [string, number][]): cfv2.CF2File {
        return {
          id,
          displayName,
          fileName: `${displayName}.zip`,
          downloadUrl: `https://example.test/${id}.zip`,
          fileDate: "2026-01-01T00:00:00Z",
          releaseType: cfv2.CF2FileReleaseType.Release,
          sortableGameVersions: typeIds.map((gameVersionTypeId) => ({ gameVersionTypeId })),
          modules: modules.map(([name, fingerprint]) => ({ name, fingerprint })),
          dependencies: [],
        } as unknown as cfv2.CF2File;
      }

      function cfAddon(id: number, slug: string, name: string, files: cfv2.CF2File[], authors = ["someone"]) {
        return {
          id,
          slug,
          name,
          summary: "",
          downloadCount: 1,
          authors: authors.map((author) => ({ name: author })),
          screenshots: [],
          links: { websiteUrl: `https://www.curseforge.com/wow/addons/${slug}` },
          latestFiles: files,
        } as unknown as cfv2.CF2Addon;
      }

      function ok<T>(data: T): Promise<any> {
        return Promise.resolve({ statusCode: 200, data: { data } });
      }

      function noFingerprintMatches(): void {
        client.getFingerprintMatches.and.returnValue(ok({ exactMatches: [], partialMatches: [] }));
      }

      beforeEach(() => {
        clientTypeId = (provider as any).getGameVersionTypeId(clientType);
        client = jasmine.createSpyObj<cfv2.CFV2Client>("CFV2Client", [
          "getFingerprintMatches",
          "getMods",
          "searchMods",
        ]);
        client.getMods.and.returnValue(ok([]));
        client.searchMods.and.returnValue(ok([]));
        (provider as any)._cf2Client = client;
        (provider as any)._circuitBreaker = { fire: (action: () => Promise<unknown>) => action() };
        (provider as any)._tocService = { getTocForGameType2: (_name: string, tocs: Toc[]) => tocs[0] };
      });

      it("reports a failed fingerprint request instead of leaving every addon unmatched", async () => {
        client.getFingerprintMatches.and.returnValue(Promise.resolve({ statusCode: 401, data: undefined } as any));

        await expectAsync(
          provider.scan(installation, AddonChannelType.Stable, [folder("AddonA", {}, 11)]),
        ).toBeRejectedWithError(/401/);
      });

      it("matches a fingerprint of a release for the client", async () => {
        const file = cfFile(500, "AddonA 2.0", [clientTypeId], [["AddonA", 11]]);
        client.getFingerprintMatches.and.returnValue(
          ok({ exactMatches: [{ id: 1, file, latestFiles: [] }], partialMatches: [] }),
        );
        client.getMods.and.returnValue(ok([cfAddon(1, "addon-a", "AddonA", [file])]));
        const addonA = folder("AddonA", {}, 11);

        await provider.scan(installation, AddonChannelType.Stable, [addonA]);

        expect(addonA.matchingAddon?.externalId).toBe("1");
        expect(addonA.matchingAddon?.installedVersion).toBe("AddonA 2.0");
      });

      it("leaves a shipped folder with other files to its own match", async () => {
        const file = cfFile(
          500,
          "AddonA 2.0",
          [clientTypeId],
          [
            ["AddonA", 11],
            ["AddonA_Data", 12],
            ["AddonA_Extra", 13],
          ],
        );
        client.getFingerprintMatches.and.returnValue(
          ok({ exactMatches: [{ id: 1, file, latestFiles: [] }], partialMatches: [] }),
        );
        client.getMods.and.returnValue(ok([cfAddon(1, "addon-a", "AddonA", [file])]));
        const addonA = folder("AddonA", {}, 11);
        // Installed from another source, its files are not the release's
        const addonData = folder("AddonA_Data", {}, 99);

        await provider.scan(installation, AddonChannelType.Stable, [addonA, addonData]);

        expect(addonA.matchingAddon?.installedFolderList).toEqual(["AddonA"]);
        expect(addonA.matchingAddon?.installedFolders).toBe("AddonA");
        expect(addonData.matchingAddon).toBeUndefined();
      });

      it("does not match a fingerprint whose release is not for the client", async () => {
        const file = cfFile(500, "AddonA 2.0", [OTHER_CLIENT_TYPE_ID], [["AddonA", 11]]);
        client.getFingerprintMatches.and.returnValue(
          ok({ exactMatches: [{ id: 1, file, latestFiles: [] }], partialMatches: [] }),
        );
        client.getMods.and.returnValue(ok([cfAddon(1, "addon-a", "AddonA", [file])]));
        const addonA = folder("AddonA", {}, 11);

        await provider.scan(installation, AddonChannelType.Stable, [addonA]);

        expect(addonA.matchingAddon).toBeUndefined();
      });

      it("matches a folder by the project ID in its TOC and owns the other folders the release ships", async () => {
        noFingerprintMatches();
        const release = cfFile(
          700,
          "v3.1.0",
          [clientTypeId],
          [
            ["AddonA", 1],
            ["AddonA_Data", 2],
          ],
        );
        client.getMods.and.returnValue(ok([cfAddon(1001, "addon-a", "AddonA", [release])]));
        const addonA = folder("AddonA", { curseProjectId: "1001", version: "3.1.0" }, 21);
        const addonData = folder("AddonA_Data", { version: "1.0.1" }, 22);

        await provider.scan(installation, AddonChannelType.Stable, [addonA, addonData]);

        expect(client.getMods).toHaveBeenCalledWith({ modIds: [1001] });
        expect(addonA.matchingAddon?.externalId).toBe("1001");
        expect(addonA.matchingAddon?.installedExternalReleaseId).toBe("700");
        expect(addonData.matchingAddon).toBe(addonA.matchingAddon);
        expect(addonA.matchingAddon?.installedFolderList).toEqual(["AddonA", "AddonA_Data"]);
      });

      it("keeps the TOC version and an unknown release when no release has that version", async () => {
        noFingerprintMatches();
        const release = cfFile(701, "v3.2.0", [clientTypeId], [["AddonA", 1]]);
        client.getMods.and.returnValue(ok([cfAddon(1001, "addon-a", "AddonA", [release])]));
        const addonA = folder("AddonA", { curseProjectId: "1001", version: "3.1.0" }, 21);

        await provider.scan(installation, AddonChannelType.Stable, [addonA]);

        expect(addonA.matchingAddon?.installedVersion).toBe("3.1.0");
        expect(addonA.matchingAddon?.installedExternalReleaseId).toBeUndefined();
        expect(addonA.matchingAddon?.externalLatestReleaseId).toBe("701");
      });

      it("does not match a TOC project ID whose project has no release for the client", async () => {
        noFingerprintMatches();
        const release = cfFile(702, "v3.1.0", [OTHER_CLIENT_TYPE_ID], [["AddonA", 1]]);
        client.getMods.and.returnValue(ok([cfAddon(1001, "addon-a", "AddonA", [release])]));
        const addonA = folder("AddonA", { curseProjectId: "1001", version: "3.1.0" }, 21);

        await provider.scan(installation, AddonChannelType.Stable, [addonA]);

        expect(addonA.matchingAddon).toBeUndefined();
      });

      it("does not search for folders without a fingerprint or TOC ID match", async () => {
        noFingerprintMatches();
        const local = folder("Local", { title: "Local", website: "https://www.curseforge.com/wow/addons/local" }, 51);

        await provider.scan(installation, AddonChannelType.Stable, [local]);

        expect(client.searchMods).not.toHaveBeenCalled();
        expect(local.matchingAddon).toBeUndefined();
      });
    });
  }

  describe("description and changelog links", () => {
    /** Builds a provider whose cache hands back the given HTML as the CF API response. */
    function providerReturning(html: string): CurseAddonProvider {
      const cachingService = jasmine.createSpyObj<CachingService>("CachingService", ["transaction"]);
      cachingService.transaction.and.returnValue(Promise.resolve({ data: { data: html } }));
      const networkService = jasmine.createSpyObj<NetworkService>("NetworkService", ["getCircuitBreaker"]);
      networkService.getCircuitBreaker.and.returnValue({} as any);
      return new CurseAddonProvider(cachingService, networkService, {} as TocService);
    }

    // Shape taken from a real CurseForge changelog (EllesmereUI, issue #1631): remoteUrl is double-encoded
    const linkoutHtml =
      '<p><a href="/linkout?remoteUrl=https%253a%252f%252fellesmereui.com%252fpatch-notes" rel="nofollow">Patch notes</a></p>';

    it("should unwrap /linkout links in changelogs", async () => {
      const result = await providerReturning(linkoutHtml).getChangelog({} as any, "1477613", "9521650");

      expect(result).toBe('<p><a href="https://ellesmereui.com/patch-notes" rel="nofollow">Patch notes</a></p>');
    });

    it("should unwrap /linkout links in descriptions", async () => {
      const result = await providerReturning(linkoutHtml).getDescription({} as any, "1477613");

      expect(result).toContain('href="https://ellesmereui.com/patch-notes"');
    });

    it("should make other root-relative links absolute to curseforge.com", async () => {
      const result = await providerReturning("<a href='/wow/addons/details'>Details</a>").getChangelog(
        {} as any,
        "1",
        "2",
      );

      expect(result).toBe("<a href='https://www.curseforge.com/wow/addons/details'>Details</a>");
    });

    it("should leave absolute links untouched", async () => {
      const html = '<a class="x" href="https://example.test/a?b=1">A</a> <a href="//cdn.example.test/x">B</a>';

      const result = await providerReturning(html).getChangelog({} as any, "1", "2");

      expect(result).toBe(html);
    });
  });
});
