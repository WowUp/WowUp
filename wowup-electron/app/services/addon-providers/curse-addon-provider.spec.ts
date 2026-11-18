/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { expect } from "chai";
import * as cfv2 from "curseforge-v2/lib/curseforge-api-v2";
import { AddonDependencyType, AddonSearchResult } from "wowup-lib-core";

import { ProviderCache } from "../caching/provider-cache";
import { HttpCircuitBreaker } from "../network/circuit-breaker";
import { CurseForgeClient } from "../network/curseforge-client";
import { CurseAddonProvider } from "./curse-addon-provider";

function createProvider(cache = new ProviderCache()): CurseAddonProvider {
  return new CurseAddonProvider(cache, {} as HttpCircuitBreaker, {} as CurseForgeClient, 30);
}

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
    provider = createProvider();
  });

  describe("dependency mapping", () => {
    it("map each CurseForge relation type onto a WowUp dependency type", () => {
      const file = createFile([
        { modId: 1, fileId: 0, relationType: cfv2.CF2FileRelationType.RequiredDependency },
        { modId: 2, fileId: 0, relationType: cfv2.CF2FileRelationType.OptionalDependency },
        { modId: 3, fileId: 0, relationType: cfv2.CF2FileRelationType.EmbeddedLibrary },
        { modId: 4, fileId: 0, relationType: cfv2.CF2FileRelationType.Tool },
        { modId: 5, fileId: 0, relationType: cfv2.CF2FileRelationType.Incompatible },
        { modId: 6, fileId: 0, relationType: cfv2.CF2FileRelationType.Include },
      ]);

      const result = toSearchResult(file);

      expect(result?.files?.[0].dependencies).to.deep.equal([
        { externalAddonId: "1", type: AddonDependencyType.Required },
        { externalAddonId: "2", type: AddonDependencyType.Optional },
        { externalAddonId: "3", type: AddonDependencyType.Embedded },
        { externalAddonId: "4", type: AddonDependencyType.Other },
        { externalAddonId: "5", type: AddonDependencyType.Other },
        { externalAddonId: "6", type: AddonDependencyType.Other },
      ]);
    });

    it("leave the dependency list empty when the file has none", () => {
      const result = toSearchResult(createFile([]));

      expect(result?.files?.[0].dependencies).to.deep.equal([]);
    });

    it("keep the search result itself intact", () => {
      const result = toSearchResult(
        createFile([{ modId: 2002, fileId: 0, relationType: cfv2.CF2FileRelationType.RequiredDependency }]),
      );

      expect(result).to.include({ externalId: "1001", name: "Baganator", providerName: provider.name });
      expect(result?.files?.[0]).to.deep.include({ externalId: "5001", version: "1.2.0", folders: ["Baganator"] });
    });
  });

  describe("description and changelog links", () => {
    /** Builds a provider whose cache hands back the given HTML as the CF API response. */
    function providerReturning(html: string): CurseAddonProvider {
      const cache = new ProviderCache();
      cache.transaction = <T>() => Promise.resolve({ data: { data: html } } as T);
      return createProvider(cache);
    }

    // Shape taken from a real CurseForge changelog (EllesmereUI, issue #1631): remoteUrl is double-encoded
    const linkoutHtml =
      '<p><a href="/linkout?remoteUrl=https%253a%252f%252fellesmereui.com%252fpatch-notes" rel="nofollow">Patch notes</a></p>';

    it("unwrap /linkout links in changelogs", async () => {
      const result = await providerReturning(linkoutHtml).getChangelog({} as any, "1477613", "9521650");

      expect(result).to.equal('<p><a href="https://ellesmereui.com/patch-notes" rel="nofollow">Patch notes</a></p>');
    });

    it("unwrap /linkout links in descriptions", async () => {
      const result = await providerReturning(linkoutHtml).getDescription({} as any, "1477613");

      expect(result).to.contain('href="https://ellesmereui.com/patch-notes"');
    });

    it("make other root-relative links absolute to curseforge.com", async () => {
      const result = await providerReturning("<a href='/wow/addons/details'>Details</a>").getChangelog(
        {} as any,
        "1",
        "2",
      );

      expect(result).to.equal("<a href='https://www.curseforge.com/wow/addons/details'>Details</a>");
    });

    it("leave absolute links untouched", async () => {
      const html = '<a class="x" href="https://example.test/a?b=1">A</a> <a href="//cdn.example.test/x">B</a>';

      const result = await providerReturning(html).getChangelog({} as any, "1", "2");

      expect(result).to.equal(html);
    });
  });
});
