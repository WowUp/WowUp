import { expect } from "chai";
import * as Store from "electron-store";
import * as path from "path";
import { Addon, AddonChannelType, Toc, WowClientType, WowInstallation } from "wowup-lib-core";

import { ADDON_PROVIDER_UNKNOWN, ADDON_PROVIDER_ZIP } from "../../../src/common/constants";
import { AddonInstallPhase, InstallAddonFileRequest } from "../../../src/common/models/addon-install";
import { AddonRepository } from "./addon-repository";
import { AddonInstallService, AddonInstallServiceDeps, InstallFileSystem } from "./addon-install.service";

const silentLog = { info: () => undefined, warn: () => undefined, error: () => undefined };

const ADDON_FOLDER = path.join("wow", "_retail_", "Interface", "AddOns");
const DOWNLOADS = path.join("wowup", "downloads");
const ZIP_PATH = path.join(DOWNLOADS, "baganator.zip");
const UNZIP_PATH = path.join(DOWNLOADS, "unzip-1");
const INSTALLED_AT = new Date("2026-11-11T00:00:00Z");
const PROVIDERS = ["Curse", "Wago", "WowUpHub", "GitHub", ADDON_PROVIDER_UNKNOWN, ADDON_PROVIDER_ZIP];

const installation: WowInstallation = {
  id: "install-1",
  clientType: WowClientType.Retail,
  location: path.join("wow", "_retail_", "Wow.exe"),
  label: "Retail",
  displayName: "Retail",
  selected: true,
  defaultAddonChannelType: AddonChannelType.Stable,
  defaultAutoUpdate: false,
};

function createAddon(overrides: Partial<Addon> = {}): Addon {
  return {
    id: "addon-1",
    name: "Baganator",
    providerName: "Curse",
    externalId: "1001",
    externalLatestReleaseId: "5001",
    latestVersion: "1.2.0",
    installedVersion: "1.1.0",
    clientType: WowClientType.Retail,
    channelType: AddonChannelType.Stable,
    installationId: installation.id,
    installedFolderList: [],
    externalIds: [{ id: "1001", providerName: "Curse" }],
    isIgnored: false,
    autoUpdateEnabled: false,
    ...overrides,
  } as Addon;
}

function createToc(folder: string, overrides: Partial<Toc> = {}): Toc {
  return {
    fileName: `${folder}.toc`,
    filePath: path.join(folder, `${folder}.toc`),
    interface: ["110200"],
    title: folder,
    dependencyList: [],
    ...overrides,
  } as unknown as Toc;
}

/**
 * Folders only: each path in `dirs` is a directory, which is all an install looks at. A file such as
 * the zip is just a path that exists.
 */
class FakeFileSystem implements InstallFileSystem {
  public readonly dirs = new Set<string>();
  public readonly files = new Set<string>();
  public zipFolders: string[] = ["Baganator"];
  public failCopyTo?: string;
  public failUnzip = false;
  public failRemoveOf = new Set<string>();
  public readonly calls: string[] = [];

  public pathExists(filePath: string): Promise<boolean> {
    return Promise.resolve(this.dirs.has(filePath) || this.files.has(filePath));
  }

  public listDirectories(dirPath: string): Promise<string[]> {
    const names = [...this.dirs]
      .filter((dir) => path.dirname(dir) === dirPath)
      .map((dir) => path.basename(dir))
      .sort();
    return Promise.resolve(names);
  }

  public copy(sourcePath: string, destinationPath: string): Promise<void> {
    this.calls.push(`copy ${sourcePath} -> ${destinationPath}`);
    if (this.failCopyTo === destinationPath) {
      // Once, so the restore that follows can put the backup back
      this.failCopyTo = undefined;
      return Promise.reject(new Error("copy failed"));
    }
    for (const dir of [...this.dirs]) {
      if (dir === sourcePath || dir.startsWith(sourcePath + path.sep)) {
        this.dirs.add(destinationPath + dir.slice(sourcePath.length));
      }
    }
    return Promise.resolve();
  }

  public remove(filePath: string): Promise<void> {
    this.calls.push(`remove ${filePath}`);
    if (this.failRemoveOf.has(filePath)) {
      return Promise.reject(new Error("remove failed"));
    }
    this.files.delete(filePath);
    for (const dir of [...this.dirs]) {
      if (dir === filePath || dir.startsWith(filePath + path.sep)) {
        this.dirs.delete(dir);
      }
    }
    return Promise.resolve();
  }

  public unzip(zipFilePath: string, outputFolder: string): Promise<void> {
    this.calls.push(`unzip ${zipFilePath} -> ${outputFolder}`);
    if (this.failUnzip) {
      return Promise.reject(new Error("bad zip"));
    }
    this.dirs.add(outputFolder);
    for (const folder of this.zipFolders) {
      this.dirs.add(path.join(outputFolder, folder));
    }
    return Promise.resolve();
  }
}

describe("AddonInstallService (main)", () => {
  let store: Map<string, unknown>;
  let fs: FakeFileSystem;
  let tocs: Map<string, Toc[]>;
  let service: AddonInstallService;

  function stored(): Addon[] {
    return [...store.values()] as Addon[];
  }

  function request(overrides: Partial<InstallAddonFileRequest> = {}): InstallAddonFileRequest {
    return { addon: createAddon(), zipFilePath: ZIP_PATH, forceIgnore: false, providerNames: PROVIDERS, ...overrides };
  }

  beforeEach(() => {
    store = new Map();
    fs = new FakeFileSystem();
    fs.files.add(ZIP_PATH);
    tocs = new Map();

    const deps: AddonInstallServiceDeps = {
      repository: new AddonRepository(store as unknown as Store),
      getInstallations: () => [installation],
      getAddonFolderPath: () => ADDON_FOLDER,
      downloadsFolderPath: DOWNLOADS,
      getAllTocs: (baseDir, folderNames) =>
        Promise.resolve(folderNames.flatMap((name) => tocs.get(name) ?? [createToc(name)])),
      fs,
      newId: () => "unzip-1",
      now: () => INSTALLED_AT,
      log: silentLog,
    };
    service = new AddonInstallService(deps);
  });

  describe("installFile", () => {
    it("should unzip into the downloads folder and copy each addon folder into AddOns", async () => {
      await service.installFile(request());

      expect(fs.calls).to.include(`unzip ${ZIP_PATH} -> ${UNZIP_PATH}`);
      expect(fs.calls).to.include(
        `copy ${path.join(UNZIP_PATH, "Baganator")} -> ${path.join(ADDON_FOLDER, "Baganator")}`,
      );
      expect(fs.dirs.has(path.join(ADDON_FOLDER, "Baganator"))).to.equal(true);
    });

    it("should mark the addon installed and save it", async () => {
      const { addon } = await service.installFile(request());

      expect(addon.installedVersion).to.equal("1.2.0");
      expect(addon.installedExternalReleaseId).to.equal("5001");
      expect(addon.installedAt).to.deep.equal(INSTALLED_AT);
      expect(addon.installedFolderList).to.deep.equal(["Baganator"]);
      expect(addon.installedFolders).to.equal("Baganator");
      expect(stored()).to.deep.equal([addon]);
    });

    it("should not change the addon it was sent", async () => {
      const sent = createAddon();

      await service.installFile(request({ addon: sent }));

      expect(sent.installedVersion).to.equal("1.1.0");
    });

    it("should ignore the addon when its provider forces it", async () => {
      const { addon } = await service.installFile(request({ forceIgnore: true }));

      expect(addon.isIgnored).to.equal(true);
    });

    it("should skip folders like __MACOSX", async () => {
      fs.zipFolders = ["Baganator", "__MACOSX"];

      const { addon } = await service.installFile(request());

      expect(addon.installedFolderList).to.deep.equal(["Baganator"]);
      expect(fs.dirs.has(path.join(ADDON_FOLDER, "__MACOSX"))).to.equal(false);
    });

    it("should take game versions and a missing author from the tocs", async () => {
      fs.zipFolders = ["Baganator", "Baganator_Config"];
      tocs.set("Baganator", [createToc("Baganator", { interface: ["110200", "50500"], author: "plusmouse" })]);
      tocs.set("Baganator_Config", [createToc("Baganator_Config", { interface: [], author: "pm" })]);

      const { addon } = await service.installFile(request());

      expect(addon.gameVersion).to.deep.equal(["11.2.0", "5.5.0"]);
      expect(addon.author).to.equal("plusmouse");
    });

    it("should keep an author the provider already gave", async () => {
      tocs.set("Baganator", [createToc("Baganator", { author: "someone else" })]);

      const { addon } = await service.installFile(request({ addon: createAddon({ author: "plusmouse" }) }));

      expect(addon.author).to.equal("plusmouse");
    });

    it("should name a zip addon after its longest toc title", async () => {
      fs.zipFolders = ["Bag", "BagConfig"];
      tocs.set("Bag", [createToc("Bag", { title: "Bag" })]);
      tocs.set("BagConfig", [createToc("BagConfig", { title: "Bag Config Panel" })]);

      const { addon } = await service.installFile(
        request({ addon: createAddon({ providerName: ADDON_PROVIDER_ZIP, name: "bag.zip", externalIds: [] }) }),
      );

      expect(addon.name).to.equal("Bag Config Panel");
    });

    it("should report backing up, then installing", async () => {
      const phases: AddonInstallPhase[] = [];

      await service.installFile(request(), (phase) => phases.push(phase));

      expect(phases).to.deep.equal(["backingUp", "installing"]);
    });

    it("should delete the zip and the unzipped folder afterwards", async () => {
      await service.installFile(request());

      expect(fs.files.has(ZIP_PATH)).to.equal(false);
      expect(fs.dirs.has(UNZIP_PATH)).to.equal(false);
    });

    it("should back up the installed folders and drop the backup once the new version is in", async () => {
      const installed = path.join(ADDON_FOLDER, "Baganator");
      fs.dirs.add(installed);

      await service.installFile(request({ addon: createAddon({ installedFolderList: ["Baganator"] }) }));

      expect(fs.calls).to.include(`copy ${installed} -> ${installed}-bak`);
      expect(fs.dirs.has(`${installed}-bak`)).to.equal(false);
      expect(fs.dirs.has(installed)).to.equal(true);
    });

    it("should restore the backup and delete the zip when unzipping fails", async () => {
      const installed = path.join(ADDON_FOLDER, "Baganator");
      fs.dirs.add(installed);
      fs.failUnzip = true;

      let error: unknown;
      try {
        await service.installFile(request({ addon: createAddon({ installedFolderList: ["Baganator"] }) }));
      } catch (e) {
        error = e;
      }

      expect((error as Error).message).to.equal("bad zip");
      expect(fs.dirs.has(installed)).to.equal(true);
      expect(fs.dirs.has(`${installed}-bak`)).to.equal(false);
      expect(fs.files.has(ZIP_PATH)).to.equal(false);
      expect(stored()).to.deep.equal([]);
    });

    it("should restore the backup when a copy into AddOns fails", async () => {
      const installed = path.join(ADDON_FOLDER, "Baganator");
      fs.dirs.add(installed);
      fs.failCopyTo = installed;

      let error: unknown;
      try {
        await service.installFile(request({ addon: createAddon({ installedFolderList: ["Baganator"] }) }));
      } catch (e) {
        error = e;
      }

      expect((error as Error).message).to.equal("copy failed");
      expect(fs.calls).to.include(`copy ${installed}-bak -> ${installed}`);
      expect(fs.dirs.has(installed)).to.equal(true);
    });

    it("should reject an unknown installation without touching the AddOns folder", async () => {
      let error: unknown;
      try {
        await service.installFile(request({ addon: createAddon({ installationId: "gone" }) }));
      } catch (e) {
        error = e;
      }

      expect((error as Error).message).to.equal("Installation not found: gone");
      expect(fs.calls.filter((call) => call.startsWith("copy"))).to.deep.equal([]);
      expect(fs.files.has(ZIP_PATH)).to.equal(false);
    });

    it("should collect external ids from the tocs when the addon lacks its own", async () => {
      tocs.set("Baganator", [createToc("Baganator", { curseProjectId: "1001", wagoAddonId: "ZQ6aZqKW" })]);

      const { addon } = await service.installFile(request({ addon: createAddon({ externalIds: [] }) }));

      expect(addon.externalIds).to.deep.equal([
        { id: "1001", providerName: "Curse" },
        { id: "ZQ6aZqKW", providerName: "Wago" },
      ]);
    });

    it("should record a hub addon's own id", async () => {
      const { addon } = await service.installFile(
        request({ addon: createAddon({ providerName: "WowUpHub", externalId: "31", externalIds: [] }) }),
      );

      expect(addon.externalIds).to.deep.equal([{ id: "31", providerName: "WowUpHub" }]);
    });

    it("should carry the original addon's external ids over and drop ones this build can't use", async () => {
      const originalAddon = createAddon({
        providerName: "Wago",
        externalId: "ZQ6aZqKW",
        externalIds: [
          { id: "ZQ6aZqKW", providerName: "Wago" },
          { id: "77", providerName: "TukUI" },
          { id: "not-a-number", providerName: "WowUpHub" },
        ],
      });

      const { addon } = await service.installFile(request({ originalAddon }));

      expect(addon.externalIds).to.deep.equal([
        { id: "1001", providerName: "Curse" },
        { id: "ZQ6aZqKW", providerName: "Wago" },
      ]);
    });

    it("should drop unknown addons whose folders it now owns", async () => {
      const unknown = createAddon({ id: "unknown-1", providerName: ADDON_PROVIDER_UNKNOWN, externalId: undefined });
      unknown.installedFolderList = ["Baganator"];
      const other = createAddon({ id: "unknown-2", providerName: ADDON_PROVIDER_UNKNOWN, externalId: undefined });
      other.installedFolderList = ["Details"];
      const known = createAddon({ id: "addon-2", providerName: "Wago", installedFolderList: ["Baganator"] });
      store.set(unknown.id, unknown);
      store.set(other.id, other);
      store.set(known.id, known);

      const { removedAddons } = await service.installFile(request());

      expect(removedAddons.map((a) => a.id)).to.deep.equal(["unknown-1"]);
      expect(
        stored()
          .map((a) => a.id)
          .sort(),
      ).to.deep.equal(["addon-1", "addon-2", "unknown-2"]);
    });
  });

  describe("installFile with a saved addon", () => {
    it("should keep settings the user changed while the install ran", async () => {
      store.set("addon-1", createAddon({ autoUpdateEnabled: true, channelType: AddonChannelType.Beta }));

      const { addon } = await service.installFile(request({ addon: createAddon({ autoUpdateEnabled: false }) }));

      expect(addon.autoUpdateEnabled).to.equal(true);
      expect(addon.channelType).to.equal(AddonChannelType.Beta);
      expect((store.get("addon-1") as Addon).autoUpdateEnabled).to.equal(true);
    });

    it("should take the new version from the caller, not the saved copy", async () => {
      store.set("addon-1", createAddon({ latestVersion: "1.1.0", installedVersion: "1.1.0" }));

      const { addon } = await service.installFile(request());

      expect(addon.installedVersion).to.equal("1.2.0");
    });

    it("should back up the folders the saved copy lists, not the caller's stale list", async () => {
      const installed = path.join(ADDON_FOLDER, "Baganator_New");
      fs.dirs.add(installed);
      store.set("addon-1", createAddon({ installedFolderList: ["Baganator_New"] }));

      await service.installFile(request({ addon: createAddon({ installedFolderList: [] }) }));

      expect(fs.calls).to.include(`copy ${installed} -> ${installed}-bak`);
    });

    it("should refuse a zip outside the downloads folder and leave it alone", async () => {
      const elsewhere = path.join("somewhere", "else.zip");
      fs.files.add(elsewhere);

      let error: unknown;
      try {
        await service.installFile(request({ zipFilePath: elsewhere }));
      } catch (e) {
        error = e;
      }

      expect((error as Error).message).to.contain("not in the downloads folder");
      expect(fs.files.has(elsewhere)).to.equal(true);
      expect(fs.calls).to.deep.equal([]);
    });

    it("should refuse a path that only climbs out of the downloads folder", async () => {
      let error: unknown;
      try {
        await service.installFile(request({ zipFilePath: path.join(DOWNLOADS, "..", "x.zip") }));
      } catch (e) {
        error = e;
      }

      expect((error as Error).message).to.contain("not in the downloads folder");
    });
  });

  describe("addExternalId", () => {
    it("should add the id to the saved addon only", () => {
      store.set("addon-1", createAddon({ autoUpdateEnabled: true }));

      const ids = service.addExternalId({ addonId: "addon-1", providerName: "WowUpHub", externalId: "50" });

      expect(ids).to.deep.equal([
        { id: "1001", providerName: "Curse" },
        { id: "50", providerName: "WowUpHub" },
      ]);
      expect((store.get("addon-1") as Addon).externalIds).to.deep.equal(ids);
      expect((store.get("addon-1") as Addon).autoUpdateEnabled).to.equal(true);
    });

    it("should not add an id twice or one the provider couldn't issue", () => {
      store.set("addon-1", createAddon());

      service.addExternalId({ addonId: "addon-1", providerName: "Curse", externalId: "1001" });
      service.addExternalId({ addonId: "addon-1", providerName: "WowUpHub", externalId: "abc" });

      expect((store.get("addon-1") as Addon).externalIds).to.deep.equal([{ id: "1001", providerName: "Curse" }]);
    });

    it("should return undefined for an addon that isn't saved", () => {
      expect(service.addExternalId({ addonId: "nope", providerName: "WowUpHub", externalId: "50" })).to.equal(
        undefined,
      );
    });
  });

  describe("removeAddon", () => {
    it("should delete the addon's folders and forget it", async () => {
      const addon = createAddon({ installedFolderList: ["Baganator", "Baganator_Config"] });
      store.set(addon.id, addon);
      fs.dirs.add(path.join(ADDON_FOLDER, "Baganator"));
      fs.dirs.add(path.join(ADDON_FOLDER, "Baganator_Config"));

      const { removedAddons } = await service.removeAddon({
        addon,
        removeDependencies: false,
        removeDirectories: true,
      });

      expect(removedAddons.map((a) => a.id)).to.deep.equal(["addon-1"]);
      expect(fs.dirs.size).to.equal(0);
      expect(stored()).to.deep.equal([]);
    });

    it("should leave the folders when asked to", async () => {
      const addon = createAddon({ installedFolderList: ["Baganator"] });
      store.set(addon.id, addon);
      fs.dirs.add(path.join(ADDON_FOLDER, "Baganator"));

      await service.removeAddon({ addon, removeDependencies: false, removeDirectories: false });

      expect(fs.dirs.has(path.join(ADDON_FOLDER, "Baganator"))).to.equal(true);
      expect(stored()).to.deep.equal([]);
    });

    it("should delete the folders main last saved, not the caller's stale copy", async () => {
      store.set("addon-1", createAddon({ installedFolderList: ["Baganator", "Baganator_New"] }));

      await service.removeAddon({
        addon: createAddon({ installedFolderList: ["Baganator"] }),
        removeDependencies: false,
        removeDirectories: true,
      });

      expect(fs.calls).to.include(`remove ${path.join(ADDON_FOLDER, "Baganator_New")}`);
    });

    it("should still remove an addon that was never saved", async () => {
      const { removedAddons } = await service.removeAddon({
        addon: createAddon({ installedFolderList: ["Baganator"] }),
        removeDependencies: false,
        removeDirectories: true,
      });

      expect(removedAddons.map((a) => a.id)).to.deep.equal(["addon-1"]);
    });

    it("should leave the addon alone when its installation is gone", async () => {
      const addon = createAddon({ installationId: "gone", installedFolderList: ["Baganator"] });
      store.set(addon.id, addon);

      const { removedAddons } = await service.removeAddon({
        addon,
        removeDependencies: false,
        removeDirectories: true,
      });

      expect(removedAddons).to.deep.equal([]);
      expect(stored()).to.deep.equal([addon]);
    });

    it("should throw when no folder could be deleted", async () => {
      const addon = createAddon({ installedFolderList: ["Baganator"] });
      store.set(addon.id, addon);
      fs.failRemoveOf.add(path.join(ADDON_FOLDER, "Baganator"));

      let error: unknown;
      try {
        await service.removeAddon({ addon, removeDependencies: false, removeDirectories: true });
      } catch (e) {
        error = e;
      }

      expect((error as Error).message).to.equal("Failed to remove all directories");
      expect(stored()).to.deep.equal([addon]);
    });

    it("should remove installed dependencies only when asked", async () => {
      const addon = createAddon({
        installedFolderList: ["Baganator"],
        dependencies: [
          { externalAddonId: "2002", type: 3 },
          { externalAddonId: "3003", type: 3 },
        ],
      } as Partial<Addon>);
      const dependency = createAddon({ id: "addon-2", externalId: "2002", installedFolderList: ["LibBag"] });
      store.set(addon.id, addon);
      store.set(dependency.id, dependency);

      const kept = await service.removeAddon({ addon, removeDependencies: false, removeDirectories: true });
      expect(kept.removedAddons.map((a) => a.id)).to.deep.equal(["addon-1"]);
      expect(stored().map((a) => a.id)).to.deep.equal(["addon-2"]);

      store.set(addon.id, addon);
      const removed = await service.removeAddon({ addon, removeDependencies: true, removeDirectories: true });
      expect(removed.removedAddons.map((a) => a.id)).to.deep.equal(["addon-1", "addon-2"]);
      expect(stored()).to.deep.equal([]);
    });
  });
});
