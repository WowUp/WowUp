import { expect } from "chai";
import {
  Addon,
  AddonChannelType,
  AddonFolder,
  AddonWarningType,
  GenericProviderError,
  SourceRemovedAddonError,
  Toc,
  WowClientType,
  WowInstallation,
} from "wowup-lib-core";

import { PREF_WAGO_ACCESS_KEY } from "../../../src/common/constants";
import { AssetMissingError, GitHubLimitError } from "../../../src/common/errors";
import { AddonProviderCallResult, SerializedProviderError } from "../../../src/common/models/addon-provider";
import { HttpError } from "../network/http-client";
import { AddonProviderRegistry } from "./addon-provider-registry";
import { serializeProviderError } from "./provider-errors";

const silentLog = { info: () => undefined, error: () => undefined };

const installation = { id: "inst-1", clientType: WowClientType.Retail, location: "C:/wow" } as WowInstallation;

interface RegistryOptions {
  wago?: boolean;
  curseforge?: boolean;
  secrets?: Record<string, string>;
}

function createRegistry(
  fetchResponse: (url: string, init: RequestInit) => Response,
  { wago = false, curseforge = false, secrets = {} }: RegistryOptions = {},
) {
  const requests: { url: string; init: RequestInit }[] = [];
  const listeners = {
    secret: new Map<string, (value: unknown) => void>(),
    token: undefined as ((token: string) => void) | undefined,
    resume: undefined as (() => void) | undefined,
  };
  let adReloads = 0;
  const registry = new AddonProviderRegistry({
    config: {
      wowUpHubUrl: "https://hub.test",
      wowUpWebsiteUrl: "https://site.test",
      defaultHttpTimeoutMs: 1000,
      defaultHttpResetTimeoutMs: 1000,
      wowUpHubHttpTimeoutMs: 1000,
      wagoHttpTimeoutMs: 1000,
      featuredAddonsCacheTimeSec: 30,
      wago: { enabled: wago },
      curseforge: { enabled: curseforge, apiKey: "cf-key", httpTimeoutMs: 1000 },
    },
    fetch: (url, init) => {
      requests.push({ url, init });
      return Promise.resolve(fetchResponse(url, init));
    },
    installId: "install-1",
    platform: "win32",
    getAddonFolderPath: () => "C:/wow/Interface/AddOns",
    listTocFiles: () => Promise.resolve([]),
    parseToc: () => Promise.reject(new Error("no tocs here")),
    getLatestDirUpdateTime: () => Promise.resolve(Date.parse("2026-10-01")),
    newId: () => "new-id",
    getSecret: (key) => secrets[key],
    onSecretChange: (key, listener) => {
      listeners.secret.set(key, listener);
      return () => listeners.secret.delete(key);
    },
    onWagoToken: (listener) => {
      listeners.token = listener;
      return () => (listeners.token = undefined);
    },
    onPowerResume: (listener) => {
      listeners.resume = listener;
      return () => (listeners.resume = undefined);
    },
    reloadAd: () => adReloads++,
    log: silentLog,
  });
  return { registry, requests, listeners, adReloads: () => adReloads };
}

const WAGO_TOKEN = "a-wago-api-token-longer-than-twenty";

function expectOk(result: AddonProviderCallResult): unknown {
  if ("error" in result) {
    throw new Error(`expected ok, got ${result.error.message}`);
  }
  return result.value;
}

function expectError(result: AddonProviderCallResult): SerializedProviderError {
  if (!("error" in result)) {
    throw new Error("expected an error");
  }
  return result.error;
}

function rioFolder(name: string, toc: Partial<Toc>): AddonFolder {
  return {
    name,
    path: `C:/wow/Interface/AddOns/${name}`,
    status: "",
    tocs: [{ fileName: `${name}.toc`, interface: ["110200"], title: name, version: "1.0", ...toc } as Toc],
  };
}

describe("AddonProviderRegistry", () => {
  it("should list its providers in the factory's order", () => {
    const { registry } = createRegistry(() => new Response("[]"));

    const names = registry.getDescriptors().map((d) => d.name);

    expect(names).to.deep.equal(["Zip", "RaiderIO", "WowUpCompanion", "WowUpHub", "TukUI", "WowInterface", "GitHub"]);
    const hub = registry.getDescriptors().find((d) => d.name === "WowUpHub");
    expect(hub).to.include({ enabled: true, canBatchFetch: true, allowEdit: true });
  });

  it("should say which providers claim a url or a protocol link", () => {
    const { registry } = createRegistry(() => new Response("[]"));

    expect(registry.match({ kind: "uri", value: "https://files.test/MyAddon.zip" })).to.deep.equal(["Zip"]);
    expect(registry.match({ kind: "protocol", value: "wowup://hub.test/addon/1/2" })).to.deep.equal(["WowUpHub"]);
    expect(registry.match({ kind: "uri", value: "not a url" })).to.deep.equal([]);
  });

  it("should refuse a method that isn't a provider method, or a provider it doesn't have", async () => {
    const { registry } = createRegistry(() => new Response("[]"));

    const notAMethod = await registry.call({ providerName: "Zip", method: "constructor" as never, args: [] });
    const noProvider = await registry.call({ providerName: "Curse", method: "getById", args: [] });
    const notOnProvider = await registry.call({ providerName: "Zip", method: "getAddonIdsByFingerprints", args: [] });

    expect(expectError(notAMethod).message).to.equal("Not a provider method: constructor");
    expect(expectError(noProvider).message).to.equal("Addon provider not found: Curse");
    expect(expectError(notOnProvider).message).to.equal("Zip has no getAddonIdsByFingerprints");
  });

  it("should rebuild the url for searchByUrl and check what it serves", async () => {
    const { registry, requests } = createRegistry(
      () => new Response(null, { status: 200, headers: { "content-type": "application/zip" } }),
    );

    const value = expectOk(
      await registry.call({
        providerName: "Zip",
        method: "searchByUrl",
        args: ["https://files.test/dl/MyAddon.zip", installation],
      }),
    ) as { searchResult: { name: string; files: { folders: string[] }[] } };

    expect(requests[0].init.method).to.equal("HEAD");
    expect(value.searchResult.name).to.equal("MyAddon.zip");
    expect(value.searchResult.files[0].folders).to.deep.equal(["MyAddon"]);
  });

  it("should send a failed request back as an http error with its status", async () => {
    const { registry } = createRegistry(() => new Response("", { status: 404, statusText: "Not Found" }));

    const result = await registry.call({
      providerName: "Zip",
      method: "getById",
      args: ["https://files.test/MyAddon.zip", installation],
    });

    expect(expectError(result)).to.include({ kind: "http", status: 404, url: "https://files.test/MyAddon.zip" });
  });

  it("should hand back the matches a scan made, by folder", async () => {
    const { registry } = createRegistry(() => new Response("[]"));
    const folders = [
      rioFolder("Baganator", {}),
      rioFolder("RaiderIO", { website: "https://raider.io", addonProvider: "raiderio-client", title: "Raider.IO" }),
      rioFolder("RaiderIO_DB_US", { dependencies: "RaiderIO" }),
    ];

    const value = expectOk(
      await registry.call({
        providerName: "RaiderIO",
        method: "scan",
        args: [installation, AddonChannelType.Stable, folders],
      }),
    ) as (Addon | undefined)[];

    expect(value[0]).to.equal(undefined);
    expect(value[1]).to.include({
      name: "Raider.IO",
      providerName: "RaiderIO",
      installedFolders: "RaiderIO,RaiderIO_DB_US",
    });
    expect(value[2]?.installedFolderList).to.deep.equal(["RaiderIO", "RaiderIO_DB_US"]);
  });

  it("should serialize the errors a getAll returns inside its result", async () => {
    const { registry } = createRegistry(() => new Response("[]"));

    const value = expectOk(
      await registry.call({ providerName: "TukUI", method: "getAll", args: [installation, ["8814", "abcd"]] }),
    ) as { errors: SerializedProviderError[] };

    expect(value.errors.map((e) => e.kind)).to.deep.equal(["error", "sourceRemoved"]);
    expect(value.errors[1].addonId).to.equal("8814");
  });

  it("should send the install id and platform with each hub request", async () => {
    const { registry, requests } = createRegistry(() => new Response("{}"));

    await registry.call({ providerName: "WowUpHub", method: "getById", args: ["31", installation] });

    expect(requests[0].url.startsWith("https://hub.test/")).to.equal(true);
    expect(requests[0].init.headers).to.include({ "X-WowUp-Install-Id": "install-1", "X-WowUp-Platform": "win32" });
  });
});

describe("AddonProviderRegistry with Wago and CurseForge", () => {
  let consoleLog: typeof console.log;
  let consoleError: typeof console.error;
  beforeEach(() => {
    consoleLog = console.log;
    consoleError = console.error;
    console.log = () => undefined;
    console.error = () => undefined;
  });
  afterEach(() => {
    console.log = consoleLog;
    console.error = consoleError;
  });

  it("should put them between the hub and TukUI, as the renderer did", () => {
    const { registry } = createRegistry(() => new Response("[]"), { wago: true, curseforge: true });

    expect(registry.getDescriptors().map((d) => d.name)).to.deep.equal([
      "Zip",
      "RaiderIO",
      "WowUpCompanion",
      "WowUpHub",
      "Wago",
      "Curse",
      "TukUI",
      "WowInterface",
      "GitHub",
    ]);
  });

  it("should describe the Wago ad, required unless an access key is saved", () => {
    const withoutKey = createRegistry(() => new Response("[]"), { wago: true }).registry;
    const withKey = createRegistry(() => new Response("[]"), {
      wago: true,
      secrets: { [PREF_WAGO_ACCESS_KEY]: WAGO_TOKEN },
    }).registry;

    const wago = withoutKey.getDescriptors().find((d) => d.name === "Wago");
    expect(wago?.adRequired).to.equal(true);
    expect(wago?.adPageParams?.pageUrl).to.equal("https://addons.wago.io/wowup_ad_nitro");
    expect(withKey.getDescriptors().find((d) => d.name === "Wago")?.adRequired).to.equal(false);
  });

  it("should call Wago with the token the ad page handed over", async () => {
    const { registry, requests, listeners } = createRegistry(
      () => new Response(JSON.stringify({ description: "hello" })),
      { wago: true },
    );
    listeners.token?.(WAGO_TOKEN);

    const value = expectOk(
      await registry.call({ providerName: "Wago", method: "getDescription", args: [installation, "abc"] }),
    );

    expect(value).to.contain("hello");
    expect(requests[0].url).to.equal("https://addons.wago.io/api/external/addons/abc");
    expect(requests[0].init.headers).to.include({ Authorization: "Bearer " + WAGO_TOKEN });
  });

  it("should switch Wago to an access key saved while running", async () => {
    const { registry, requests, listeners } = createRegistry(() => new Response(JSON.stringify({})), {
      wago: true,
    });
    listeners.secret.get(PREF_WAGO_ACCESS_KEY)?.("a-saved-access-key-longer-than-twenty");

    await registry.call({ providerName: "Wago", method: "getDescription", args: [installation, "abc"] });

    expect(requests[0].init.headers).to.include({ Authorization: "Bearer a-saved-access-key-longer-than-twenty" });
  });

  it("should reload the ad page when a Wago request fails", async () => {
    const { registry, listeners, adReloads } = createRegistry(() => new Response("{}", { status: 401 }), {
      wago: true,
    });
    listeners.token?.(WAGO_TOKEN);

    await registry.call({ providerName: "Wago", method: "getDescription", args: [installation, "abc"] });

    expect(adReloads()).to.equal(1);
  });

  it("should stop listening when disposed", () => {
    const { registry, listeners } = createRegistry(() => new Response("[]"), { wago: true });

    registry.dispose();

    expect(listeners.token).to.equal(undefined);
    expect(listeners.resume).to.equal(undefined);
    expect(listeners.secret.size).to.equal(0);
  });

  it("should send the CurseForge api key with each request and with downloads", async () => {
    const { registry, requests } = createRegistry(() => new Response(JSON.stringify({ data: "<p>about</p>" })), {
      curseforge: true,
    });

    const description = expectOk(
      await registry.call({ providerName: "Curse", method: "getDescription", args: [installation, "1001"] }),
    );
    const auth = expectOk(await registry.call({ providerName: "Curse", method: "getDownloadAuth", args: [] }));

    expect(description).to.equal("<p>about</p>");
    expect(requests[0].url).to.equal("https://api.curseforge.com/v1/mods/1001/description");
    expect(requests[0].init.headers).to.include({ "x-api-key": "cf-key" });
    expect(auth).to.deep.equal({ headers: { "X-Api-Key": "cf-key" } });
  });
});

describe("serializeProviderError", () => {
  it("should keep what callers branch on for each kind of error", () => {
    const breakerOpen = Object.assign(new Error("Breaker is open"), { code: "EOPENBREAKER" });

    expect(serializeProviderError(breakerOpen)).to.include({ kind: "error", code: "EOPENBREAKER" });
    expect(serializeProviderError(new HttpError(503, "https://hub.test", "Unavailable"))).to.include({
      kind: "http",
      status: 503,
    });
    expect(serializeProviderError(new SourceRemovedAddonError("31", new Error("gone")))).to.deep.include({
      kind: "sourceRemoved",
      addonId: "31",
      warningType: AddonWarningType.MissingOnProvider,
      innerError: { kind: "error", name: "Error", message: "gone" },
    });
    expect(
      serializeProviderError(new GenericProviderError(undefined, "bad", AddonWarningType.NoProviderFiles)),
    ).to.include({ kind: "provider", message: "bad", warningType: AddonWarningType.NoProviderFiles });
    expect(serializeProviderError("plain")).to.deep.equal({ kind: "error", name: "Error", message: "plain" });
    expect(serializeProviderError(new GitHubLimitError(60, 60, 0, 1700000000))).to.deep.include({
      kind: "githubLimit",
      rateLimit: { max: 60, used: 60, remaining: 0, reset: 1700000000 },
    });
    expect(serializeProviderError(new AssetMissingError("https://github.com/a/b", 2))).to.include({
      kind: "assetMissing",
      clientGroup: 2,
    });
  });
});
