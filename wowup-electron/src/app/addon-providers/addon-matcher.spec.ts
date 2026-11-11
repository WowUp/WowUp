import { Addon, AddonFolder, Toc } from "wowup-lib-core";

import { AddonMatcher, isReleaseOfVersion, MatchProject, MatchRelease, MatchSource } from "./addon-matcher";

type Project = MatchProject<string, string>;

describe("AddonMatcher", () => {
  const tocs = new Map<AddonFolder, Toc>();
  const matcher = new AddonMatcher((addonFolder) => tocs.get(addonFolder));

  function folder(name: string, toc: Partial<Toc> = {}): AddonFolder {
    const addonFolder = { name, tocs: [] } as unknown as AddonFolder;
    tocs.set(addonFolder, { fileName: `${name}.toc`, filePath: "", interface: [], dependencyList: [], ...toc });
    return addonFolder;
  }

  function release(names: string[], folders: string[], compatible = true): MatchRelease<string> {
    return { id: names[0], names, folders, compatible, source: names[0] };
  }

  function project(id: string, releases: MatchRelease<string>[]): Project {
    return { id, releases, source: id };
  }

  function createSource(projects: Project[]) {
    const source = {
      logName: "test",
      getTocProjectId: (toc: Toc) => toc.curseProjectId,
      getProjectsById: jasmine
        .createSpy("getProjectsById")
        .and.callFake((ids: string[]) => Promise.resolve(projects.filter((p) => ids.includes(p.id)))),
      createAddon: jasmine.createSpy("createAddon").and.callFake(
        (mainFolder: AddonFolder, p: Project, reference: MatchRelease<string>, installed?: { version: string }) =>
          ({
            externalId: p.id,
            installedVersion: installed ? installed.version : reference.names[0],
            installedFolderList: reference.folders,
            installedFolders: reference.folders.join(","),
          }) as unknown as Addon,
      ),
    };
    return source as typeof source & MatchSource<string, string>;
  }

  beforeEach(() => tocs.clear());

  describe("TOC project ID", () => {
    it("matches the declaring folder and the unmatched folders the release ships", async () => {
      const main = folder("AddonA", { curseProjectId: "1", version: "3.1.0" });
      const db = folder("AddonA_Data");
      const other = folder("Other");
      const source = createSource([project("1", [release(["AddonA v3.1.0"], ["AddonA", "AddonA_Data"])])]);

      await matcher.matchByTocProjectId([main, db, other], source);

      expect(main.matchingAddon?.externalId).toBe("1");
      expect(db.matchingAddon).toBe(main.matchingAddon);
      expect(other.matchingAddon).toBeUndefined();
      expect(main.matchingAddon?.installedVersion).toBe("AddonA v3.1.0");
      expect(source.getProjectsById).toHaveBeenCalledOnceWith(["1"]);
    });

    it("only claims shipped folders that are installed and not matched yet", async () => {
      const main = folder("AddonA", { curseProjectId: "1", version: "3.1.0" });
      const db = folder("AddonA_Data");
      db.matchingAddon = { externalId: "addon-a-data" } as Addon;
      const source = createSource([project("1", [release(["v3.1.0"], ["AddonA", "AddonA_Data", "AddonA_Extra"])])]);

      await matcher.matchByTocProjectId([main, db], source);

      expect(main.matchingAddon?.installedFolderList).toEqual(["AddonA"]);
      expect(main.matchingAddon?.installedFolders).toBe("AddonA");
      expect(db.matchingAddon.externalId).toBe("addon-a-data");
    });

    it("keeps the TOC version when no release is that version", async () => {
      const main = folder("AddonA", { curseProjectId: "1", version: "3.0.0" });
      const source = createSource([project("1", [release(["AddonA v3.1.0"], ["AddonA"])])]);

      await matcher.matchByTocProjectId([main], source);

      expect(main.matchingAddon?.installedVersion).toBe("3.0.0");
    });

    it("only takes releases for the client", async () => {
      const main = folder("AddonA", { curseProjectId: "1", version: "2.0" });
      const source = createSource([
        project("1", [release(["other 2.0"], ["AddonA"], false), release(["client 1.5"], ["AddonA"], true)]),
      ]);

      await matcher.matchByTocProjectId([main], source);

      // The other client's release is the TOC version, but not for this client: the installed release stays unknown
      expect(source.createAddon.calls.mostRecent().args[2].names).toEqual(["client 1.5"]);
      expect(main.matchingAddon?.installedVersion).toBe("2.0");
    });

    it("does not match a project without a release for the client", async () => {
      const main = folder("AddonA", { curseProjectId: "1", version: "2.0" });
      const source = createSource([project("1", [release(["other 2.0"], ["AddonA"], false)])]);

      await matcher.matchByTocProjectId([main], source);

      expect(source.createAddon).not.toHaveBeenCalled();
      expect(main.matchingAddon).toBeUndefined();
    });

    it("leaves folders that are already matched alone", async () => {
      const main = folder("AddonA", { curseProjectId: "1" });
      main.matchingAddon = { externalId: "fingerprint" } as Addon;
      const source = createSource([project("1", [release(["1"], ["AddonA"])])]);

      await matcher.matchByTocProjectId([main], source);

      expect(source.getProjectsById).not.toHaveBeenCalled();
      expect(main.matchingAddon.externalId).toBe("fingerprint");
    });
  });

  it("only logs a failing step", async () => {
    const main = folder("AddonA", { curseProjectId: "1" });
    const source = createSource([]);
    source.getProjectsById.and.rejectWith(new Error("offline"));
    spyOn(console, "error");

    await expectAsync(matcher.matchUnmatched([main], source)).toBeResolved();
    expect(console.error).toHaveBeenCalled();
  });

  describe("helpers", () => {
    it("finds the TOC version in a release name as a whole", () => {
      expect(isReleaseOfVersion(["AddonA v3.1.0"], "3.1.0")).toBeTrue();
      expect(isReleaseOfVersion(["x", "AddonB-120.zip"], "120")).toBeTrue();
      expect(isReleaseOfVersion(["v3.1.0"], "v3.1.0")).toBeTrue();
      expect(isReleaseOfVersion(["AddonA v3.1.01"], "3.1.0")).toBeFalse();
      expect(isReleaseOfVersion(["AddonA 3.1.0.1"], "3.1.0")).toBeFalse();
      expect(isReleaseOfVersion(["AddonA 1.3.1.0"], "3.1.0")).toBeFalse();
      expect(isReleaseOfVersion(["AddonA 3.1.0"], "")).toBeFalse();
    });
  });
});
