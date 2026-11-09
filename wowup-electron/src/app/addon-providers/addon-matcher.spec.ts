import { Addon, AddonFolder, Toc } from "wowup-lib-core";

import {
  AddonMatcher,
  cleanTocTitle,
  isReleaseOfVersion,
  MatchProject,
  MatchRelease,
  MatchSource,
  MAX_SCAN_SEARCHES,
  preferCompatible,
  splitAuthors,
} from "./addon-matcher";

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

  function project(id: string, releases: MatchRelease<string>[], extra: Partial<Project> = {}): Project {
    return { id, name: id, authors: [], releases, source: id, ...extra };
  }

  function createSource(projects: Project[], withSearch = true) {
    const source = {
      logName: "test",
      getTocProjectId: (toc: Toc) => toc.curseProjectId,
      getProjectsById: jasmine
        .createSpy("getProjectsById")
        .and.callFake((ids: string[]) => Promise.resolve(projects.filter((p) => ids.includes(p.id)))),
      searchProjects: withSearch ? jasmine.createSpy("searchProjects").and.resolveTo(projects) : undefined,
      getSlugFromWebsite: (website: string | undefined) => /example\.test\/([a-z]+)/.exec(website ?? "")?.[1],
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
      const main = folder("Questie", { curseProjectId: "1", version: "12.6.4" });
      const db = folder("QuestieDB");
      const other = folder("Other");
      const source = createSource([project("1", [release(["Questie v12.6.4"], ["Questie", "QuestieDB"])])]);

      await matcher.matchByTocProjectId([main, db, other], source);

      expect(main.matchingAddon?.externalId).toBe("1");
      expect(db.matchingAddon).toBe(main.matchingAddon);
      expect(other.matchingAddon).toBeUndefined();
      expect(main.matchingAddon?.installedVersion).toBe("Questie v12.6.4");
      expect(source.getProjectsById).toHaveBeenCalledOnceWith(["1"]);
    });

    it("keeps the TOC version when no release is that version", async () => {
      const main = folder("Questie", { curseProjectId: "1", version: "12.0.0" });
      const source = createSource([project("1", [release(["Questie v12.6.4"], ["Questie"])])]);

      await matcher.matchByTocProjectId([main], source);

      expect(main.matchingAddon?.installedVersion).toBe("12.0.0");
    });

    it("prefers the release for the client", async () => {
      const main = folder("Questie", { curseProjectId: "1", version: "1.0" });
      const source = createSource([
        project("1", [release(["other 2.0"], ["Questie"], false), release(["client 1.5"], ["Questie"], true)]),
      ]);

      await matcher.matchByTocProjectId([main], source);

      expect(source.createAddon.calls.mostRecent().args[2].names).toEqual(["client 1.5"]);
    });

    it("leaves folders that are already matched alone", async () => {
      const main = folder("Questie", { curseProjectId: "1" });
      main.matchingAddon = { externalId: "fingerprint" } as Addon;
      const source = createSource([project("1", [release(["1"], ["Questie"])])]);

      await matcher.matchByTocProjectId([main], source);

      expect(source.getProjectsById).not.toHaveBeenCalled();
      expect(main.matchingAddon.externalId).toBe("fingerprint");
    });
  });

  describe("search", () => {
    it("accepts a project found by the TOC website slug", async () => {
      const addonFolder = folder("Auctionator", { website: "https://example.test/auctionator", title: "x" });
      const source = createSource([
        project("2", [release(["343"], ["Auctionator"])], { slug: "other" }),
        project("1", [release(["343"], ["Auctionator"])], { slug: "auctionator" }),
      ]);

      await matcher.matchBySearch([addonFolder], source);

      expect(source.searchProjects).toHaveBeenCalledOnceWith({ slug: "auctionator" });
      expect(addonFolder.matchingAddon?.externalId).toBe("1");
    });

    it("accepts a title search result by its author", async () => {
      const addonFolder = folder("Baganator", { title: "|cff00ff00Baganator|r", author: "plusmouse, someone" });
      const source = createSource([
        project("1", [release(["1"], ["Baganator"])], { name: "Bags", authors: ["Plusmouse"] }),
      ]);

      await matcher.matchBySearch([addonFolder], source);

      expect(source.searchProjects).toHaveBeenCalledOnceWith({ title: "Baganator" });
      expect(addonFolder.matchingAddon?.externalId).toBe("1");
    });

    it("rejects a project that does not ship the folder", async () => {
      const addonFolder = folder("Baganator", { title: "Baganator" });
      const source = createSource([project("1", [release(["1"], ["Other"])], { name: "Baganator" })]);

      await matcher.matchBySearch([addonFolder], source);

      expect(addonFolder.matchingAddon).toBeUndefined();
    });

    it("rejects a title search result that only shares the folder name", async () => {
      const addonFolder = folder("Utils", { title: "My Utils", author: "me" });
      const source = createSource([project("1", [release(["1"], ["Utils"])], { name: "Other", authors: ["you"] })]);

      await matcher.matchBySearch([addonFolder], source);

      expect(addonFolder.matchingAddon).toBeUndefined();
    });

    it("skips load on demand folders and providers without a search", async () => {
      const lod = folder("Lib", { title: "Lib", loadOnDemand: "1" });
      const source = createSource([project("1", [release(["1"], ["Lib"])], { name: "Lib" })]);
      await matcher.matchBySearch([lod], source);
      expect(source.searchProjects).not.toHaveBeenCalled();

      const addonFolder = folder("Lib2", { title: "Lib2" });
      await matcher.matchBySearch([addonFolder], createSource([project("1", [release(["1"], ["Lib2"])])], false));
      expect(addonFolder.matchingAddon).toBeUndefined();
    });

    it("searches at most MAX_SCAN_SEARCHES folders", async () => {
      const folders = Array.from({ length: MAX_SCAN_SEARCHES + 5 }, (_, i) => folder(`F${i}`, { title: `F${i}` }));
      const source = createSource([]);

      await matcher.matchBySearch(folders, source);

      expect(source.searchProjects).toHaveBeenCalledTimes(MAX_SCAN_SEARCHES);
    });
  });

  it("only logs a failing step", async () => {
    const main = folder("Questie", { curseProjectId: "1" });
    const source = createSource([]);
    source.getProjectsById.and.rejectWith(new Error("offline"));
    spyOn(console, "error");

    await expectAsync(matcher.matchUnmatched([main], source)).toBeResolved();
    expect(console.error).toHaveBeenCalled();
  });

  describe("helpers", () => {
    it("prefers a compatible candidate and falls back to the first", () => {
      expect(preferCompatible([1, 2, 3], (n) => n === 2)).toBe(2);
      expect(preferCompatible([1, 2, 3], () => false)).toBe(1);
      expect(preferCompatible([], () => true)).toBeUndefined();
    });

    it("strips color codes and an appended version from a TOC title", () => {
      expect(cleanTocTitle("Questie|cFF00FF00 v12.6.4|r")).toBe("Questie");
      expect(cleanTocTitle("|cff00ccffDetails!|r Damage Meter")).toBe("Details! Damage Meter");
      expect(cleanTocTitle("QuestieDB")).toBe("QuestieDB");
    });

    it("splits a TOC author line into names", () => {
      expect(splitAuthors("plusmouse, Borjamacare")).toEqual(["plusmouse", "borjamacare"]);
      expect(splitAuthors("Aero/Logon/Muehe")).toEqual(["aero", "logon", "muehe"]);
      expect(splitAuthors("")).toEqual([]);
    });

    it("finds the TOC version in a release name as a whole", () => {
      expect(isReleaseOfVersion(["Questie v12.6.4"], "12.6.4")).toBeTrue();
      expect(isReleaseOfVersion(["x", "Auctionator-343.zip"], "343")).toBeTrue();
      expect(isReleaseOfVersion(["v12.6.4"], "v12.6.4")).toBeTrue();
      expect(isReleaseOfVersion(["Questie v12.6.41"], "12.6.4")).toBeFalse();
      expect(isReleaseOfVersion(["Questie 12.6.4.1"], "12.6.4")).toBeFalse();
      expect(isReleaseOfVersion(["Questie 1.12.6.4"], "12.6.4")).toBeFalse();
      expect(isReleaseOfVersion(["Questie 12.6.4"], "")).toBeFalse();
    });
  });
});
