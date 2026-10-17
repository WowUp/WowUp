/* eslint-disable @typescript-eslint/no-unsafe-argument */
import * as cfv2 from "curseforge-v2";
import { AddonDependencyType, AddonSearchResult } from "wowup-lib-core";

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
});
