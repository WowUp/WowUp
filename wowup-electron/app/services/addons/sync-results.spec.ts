import { expect } from "chai";
import {
  Addon,
  AddonChannelType,
  AddonDependencyType,
  AddonSearchResult,
  AddonSearchResultFile,
  AddonWarningType,
  WowClientType,
} from "wowup-lib-core";

import { ApplyAddonSyncRequest } from "../../../src/common/models/addon-scan";
import { applyAddonSync } from "./sync-results";

const silentLog = { warn: () => undefined };

const required = (externalAddonId: string) => ({ externalAddonId, type: AddonDependencyType.Required });

function createFile(overrides: Partial<AddonSearchResultFile> = {}): AddonSearchResultFile {
  return {
    externalId: "5001",
    channelType: AddonChannelType.Stable,
    version: "1.2.0",
    folders: ["Baganator"],
    gameVersion: "110200",
    downloadUrl: "https://example.test/baganator.zip",
    releaseDate: new Date("2026-09-01"),
    dependencies: [],
    ...overrides,
  };
}

function createSearchResult(overrides: Partial<AddonSearchResult> = {}): AddonSearchResult {
  return {
    externalId: "1001",
    name: "Baganator",
    author: "plusmouse",
    thumbnailUrl: "",
    externalUrl: "https://example.test/baganator",
    providerName: "Curse",
    downloadCount: 100,
    files: [createFile()],
    ...overrides,
  } as AddonSearchResult;
}

function createAddon(overrides: Partial<Addon> = {}): Addon {
  return {
    id: "addon-1",
    name: "Baganator",
    providerName: "Curse",
    externalId: "1001",
    latestVersion: "1.2.0",
    downloadUrl: "https://example.test/baganator.zip",
    clientType: WowClientType.Retail,
    channelType: AddonChannelType.Stable,
    installationId: "install-1",
    installedFolderList: [],
    isIgnored: false,
    autoUpdateEnabled: false,
    autoUpdateNotificationsEnabled: false,
    screenshotUrls: [],
    ...overrides,
  } as Addon;
}

function request(overrides: Partial<ApplyAddonSyncRequest>): ApplyAddonSyncRequest {
  return { providerName: "Curse", addons: [], searchResults: [], failures: [], ...overrides };
}

function syncWithLatestFile(addon: Addon, file: AddonSearchResultFile) {
  return applyAddonSync(
    request({ addons: [addon], searchResults: [createSearchResult({ files: [file] })] }),
    silentLog,
  );
}

describe("applyAddonSync", () => {
  it("takes the dependencies of a newer release", () => {
    const addon = createAddon({ externalLatestReleaseId: "5000", latestVersion: "1.0.0", dependencies: [] });

    syncWithLatestFile(addon, createFile({ externalId: "5001", dependencies: [required("2002")] }));

    expect(addon.externalLatestReleaseId).to.equal("5001");
    expect(addon.latestVersion).to.equal("1.2.0");
    expect(addon.dependencies).to.deep.equal([required("2002")]);
  });

  it("refreshes the dependencies of a record saved from an older file, and saves it", () => {
    const addon = createAddon({ externalLatestReleaseId: "5001", dependencies: [] });

    const outcome = syncWithLatestFile(addon, createFile({ externalId: "5001", dependencies: [required("2002")] }));

    expect(addon.dependencies).to.deep.equal([required("2002")]);
    expect(outcome.changed).to.deep.equal([addon]);
  });

  it("drops dependencies the latest release no longer has", () => {
    const addon = createAddon({ externalLatestReleaseId: "5000", dependencies: [required("2002")] });

    syncWithLatestFile(addon, createFile({ externalId: "5001", dependencies: [] }));

    expect(addon.dependencies).to.deep.equal([]);
  });

  it("keeps the dependencies when the provider does not report any", () => {
    const addon = createAddon({ externalLatestReleaseId: "5000", dependencies: [required("2002")] });

    syncWithLatestFile(addon, createFile({ externalId: "5001", dependencies: undefined }));

    expect(addon.dependencies).to.deep.equal([required("2002")]);
  });

  it("takes every game version the latest release targets", () => {
    const addon = createAddon({ externalLatestReleaseId: "5000", gameVersion: ["12.1.0"] });

    syncWithLatestFile(
      addon,
      createFile({ externalId: "5001", gameVersion: "12.1.7", gameVersions: ["12.1.7", "Retail", "12.1.5"] }),
    );

    expect(addon.gameVersion).to.deep.equal(["12.1.7", "12.1.5"]);
  });

  it("takes the game version of a release that was already known", () => {
    const addon = createAddon({ externalLatestReleaseId: "5001", gameVersion: ["12.1.0"] });

    syncWithLatestFile(addon, createFile({ externalId: "5001", gameVersion: "12.1.7" }));

    expect(addon.gameVersion).to.deep.equal(["12.1.7"]);
  });

  it("keeps the game version when the release does not name one", () => {
    const addon = createAddon({ externalLatestReleaseId: "5000", gameVersion: ["12.1.0"] });

    syncWithLatestFile(addon, createFile({ externalId: "5001", gameVersion: "" }));

    expect(addon.gameVersion).to.deep.equal(["12.1.0"]);
  });

  it("takes a new download url", () => {
    const addon = createAddon({ externalLatestReleaseId: "5001", downloadUrl: "https://example.test/old.zip" });

    syncWithLatestFile(addon, createFile({ externalId: "5001", downloadUrl: "https://example.test/new.zip" }));

    expect(addon.downloadUrl).to.equal("https://example.test/new.zip");
  });

  it("clears a missing-on-provider warning once the provider has the addon again", () => {
    const addon = createAddon({ warningType: AddonWarningType.MissingOnProvider });

    syncWithLatestFile(addon, createFile());

    expect(addon.warningType).to.equal(undefined);
  });

  it("flags and reports an addon the provider returned no files for", () => {
    const addon = createAddon();

    const outcome = applyAddonSync(
      request({ addons: [addon], searchResults: [createSearchResult({ files: [] })] }),
      silentLog,
    );

    expect(addon.warningType).to.equal(AddonWarningType.NoProviderFiles);
    expect(outcome.noFileAddons).to.deep.equal([{ name: "Baganator", providerName: "Curse" }]);
    expect(outcome.changed).to.deep.equal([addon]);
  });

  it("turns a legacy numeric external id into a string", () => {
    const addon = createAddon({ externalId: 1001 as unknown as string });

    syncWithLatestFile(addon, createFile());

    expect(addon.externalId).to.equal("1001");
  });

  it("ignores results for addons it wasn't asked about", () => {
    const addon = createAddon();

    const outcome = applyAddonSync(
      request({ addons: [addon], searchResults: [createSearchResult({ externalId: "9999" })] }),
      silentLog,
    );

    expect(outcome.changed).to.deep.equal([]);
  });

  describe("failures", () => {
    it("sets the provider's warning on the addon and names it", () => {
      const addon = createAddon();

      const outcome = applyAddonSync(
        request({ addons: [addon], failures: [{ addonId: "1001", warningType: AddonWarningType.MissingOnProvider }] }),
        silentLog,
      );

      expect(addon.warningType).to.equal(AddonWarningType.MissingOnProvider);
      expect(outcome.failureAddonNames).to.deep.equal(["Baganator"]);
      expect(outcome.changed).to.deep.equal([addon]);
    });

    it("names the addon but leaves it alone when there's no warning", () => {
      const addon = createAddon();

      const outcome = applyAddonSync(request({ addons: [addon], failures: [{ addonId: "1001" }] }), silentLog);

      expect(addon.warningType).to.equal(undefined);
      expect(outcome.failureAddonNames).to.deep.equal(["Baganator"]);
      expect(outcome.changed).to.deep.equal([]);
    });

    it("only matches addons of the provider that failed", () => {
      const addon = createAddon({ providerName: "Wago" });

      const outcome = applyAddonSync(
        request({ addons: [addon], failures: [{ addonId: "1001", warningType: AddonWarningType.MissingOnProvider }] }),
        silentLog,
      );

      expect(addon.warningType).to.equal(undefined);
      expect(outcome.failureAddonNames).to.deep.equal([undefined]);
    });
  });
});
