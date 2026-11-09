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
import { CurseAddonProvider, getCurseForgeSlug } from "./curse-addon-provider";

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

  describe("scan", () => {
    const RETAIL_TYPE = 517;
    const FOREVER_TYPE = 88568;
    const installation = { id: "inst", clientType: WowClientType.Forever } as WowInstallation;

    let client: jasmine.SpyObj<cfv2.CFV2Client>;

    function toc(folder: string, fields: Partial<Toc> = {}): Toc {
      return {
        fileName: `${folder}.toc`,
        filePath: `/AddOns/${folder}/${folder}.toc`,
        interface: ["16001"],
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
        fileDate: "2026-11-01T00:00:00Z",
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
      client = jasmine.createSpyObj<cfv2.CFV2Client>("CFV2Client", ["getFingerprintMatches", "getMods", "searchMods"]);
      client.getMods.and.returnValue(ok([]));
      client.searchMods.and.returnValue(ok([]));
      (provider as any)._cf2Client = client;
      (provider as any)._circuitBreaker = { fire: (action: () => Promise<unknown>) => action() };
      (provider as any)._tocService = { getTocForGameType2: (_name: string, tocs: Toc[]) => tocs[0] };
    });

    it("reports a failed fingerprint request instead of leaving every addon unmatched", async () => {
      client.getFingerprintMatches.and.returnValue(Promise.resolve({ statusCode: 401, data: undefined } as any));

      await expectAsync(
        provider.scan(installation, AddonChannelType.Stable, [folder("Questie", {}, 11)]),
      ).toBeRejectedWithError(/401/);
    });

    it("matches a fingerprint whose release is not tagged for the client", async () => {
      const file = cfFile(500, "Auctionator 343", [RETAIL_TYPE], [["Auctionator", 11]]);
      client.getFingerprintMatches.and.returnValue(
        ok({ exactMatches: [{ id: 1, file, latestFiles: [] }], partialMatches: [] }),
      );
      client.getMods.and.returnValue(ok([cfAddon(1, "auctionator", "Auctionator", [file])]));
      const auctionator = folder("Auctionator", {}, 11);

      await provider.scan(installation, AddonChannelType.Stable, [auctionator]);

      expect(auctionator.matchingAddon?.externalId).toBe("1");
      expect(auctionator.matchingAddon?.installedVersion).toBe("Auctionator 343");
    });

    it("matches a folder by the project ID in its TOC and owns the other folders the release ships", async () => {
      noFingerprintMatches();
      const release = cfFile(
        700,
        "v12.6.4",
        [FOREVER_TYPE],
        [
          ["Questie", 1],
          ["QuestieDB", 2],
        ],
      );
      client.getMods.and.returnValue(ok([cfAddon(334372, "questie", "Questie", [release])]));
      const questie = folder("Questie", { curseProjectId: "334372", version: "12.6.4" }, 21);
      const questieDb = folder("QuestieDB", { version: "1.0.13" }, 22);

      await provider.scan(installation, AddonChannelType.Stable, [questie, questieDb]);

      expect(client.getMods).toHaveBeenCalledWith({ modIds: [334372] });
      expect(questie.matchingAddon?.externalId).toBe("334372");
      expect(questie.matchingAddon?.installedExternalReleaseId).toBe("700");
      expect(questieDb.matchingAddon).toBe(questie.matchingAddon);
      expect(questie.matchingAddon?.installedFolderList).toEqual(["Questie", "QuestieDB"]);
    });

    it("keeps the TOC version and an unknown release when no release has that version", async () => {
      noFingerprintMatches();
      const release = cfFile(701, "v12.7.0", [FOREVER_TYPE], [["Questie", 1]]);
      client.getMods.and.returnValue(ok([cfAddon(334372, "questie", "Questie", [release])]));
      const questie = folder("Questie", { curseProjectId: "334372", version: "12.6.4" }, 21);

      await provider.scan(installation, AddonChannelType.Stable, [questie]);

      expect(questie.matchingAddon?.installedVersion).toBe("12.6.4");
      expect(questie.matchingAddon?.installedExternalReleaseId).toBeUndefined();
      expect(questie.matchingAddon?.externalLatestReleaseId).toBe("701");
    });

    it("looks a folder up by the CurseForge link in its TOC", async () => {
      noFingerprintMatches();
      const release = cfFile(800, "343", [FOREVER_TYPE], [["Auctionator", 1]]);
      client.searchMods.and.returnValue(ok([cfAddon(42, "auctionator", "Auctionator", [release])]));
      const auctionator = folder(
        "Auctionator",
        { title: "Auctionator", website: "https://www.curseforge.com/wow/addons/auctionator", version: "343" },
        31,
      );

      await provider.scan(installation, AddonChannelType.Stable, [auctionator]);

      expect(client.searchMods).toHaveBeenCalledWith(jasmine.objectContaining({ slug: "auctionator" }));
      expect(auctionator.matchingAddon?.externalId).toBe("42");
    });

    it("accepts a title search result only when it ships the folder and an author agrees", async () => {
      noFingerprintMatches();
      const otherFolder = cfAddon(1, "threat-meter", "ForeverThreat", [
        cfFile(1, "1.7.2", [FOREVER_TYPE], [["SomethingElse", 1]]),
      ]);
      const otherAuthor = cfAddon(2, "forever-threat-x", "Forever Threat X", [
        cfFile(2, "1.7.2", [FOREVER_TYPE], [["ForeverThreat", 1]]),
      ]);
      const match = cfAddon(
        3,
        "foreverthreat-meter",
        "Threat Meter",
        [cfFile(3, "1.7.2", [FOREVER_TYPE], [["ForeverThreat", 1]])],
        ["Loyftwa"],
      );
      client.searchMods.and.returnValue(ok([otherFolder, otherAuthor, match]));
      const threat = folder("ForeverThreat", { title: "ForeverThreat", author: "Loyftwa", version: "1.7.2" }, 41);

      await provider.scan(installation, AddonChannelType.Stable, [threat]);

      expect(client.searchMods).toHaveBeenCalledWith(jasmine.objectContaining({ searchFilter: "ForeverThreat" }));
      expect(threat.matchingAddon?.externalId).toBe("3");
    });

    it("leaves a folder unmatched when no search result ships it", async () => {
      noFingerprintMatches();
      client.searchMods.and.returnValue(
        ok([cfAddon(1, "local", "Local", [cfFile(1, "1.0", [FOREVER_TYPE], [["Other", 1]])], ["me"])]),
      );
      const local = folder("Local", { title: "Local", author: "me" }, 51);

      await provider.scan(installation, AddonChannelType.Stable, [local]);

      expect(local.matchingAddon).toBeUndefined();
    });
  });

  describe("getCurseForgeSlug", () => {
    it("reads the slug of a CurseForge addon link", () => {
      expect(getCurseForgeSlug("https://www.curseforge.com/wow/addons/auctionator")).toBe("auctionator");
      expect(getCurseForgeSlug("https://www.curseforge.com/wow/addons/deadly-boss-mods/files")).toBe(
        "deadly-boss-mods",
      );
      expect(getCurseForgeSlug("https://github.com/Questie/Questie")).toBeUndefined();
      expect(getCurseForgeSlug(undefined)).toBeUndefined();
    });
  });
});
