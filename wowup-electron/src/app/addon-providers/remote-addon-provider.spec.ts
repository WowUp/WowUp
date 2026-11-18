import { HttpErrorResponse } from "@angular/common/http";
import {
  Addon,
  AddonChannelType,
  AddonFolder,
  AddonWarningType,
  GenericProviderError,
  SourceRemovedAddonError,
  WowClientGroup,
  WowClientType,
  WowInstallation,
} from "wowup-lib-core";

import { AssetMissingError, GitHubLimitError } from "../../common/errors";

import { AddonProviderDescriptor } from "../../common/models/addon-provider";
import { AddonProviderApiService } from "../services/api/addon-provider-api.service";
import { AddonProviderFactory } from "../services/addons/addon.provider.factory";
import { WowUpService } from "../services/wowup/wowup.service";
import { RemoteAddonProvider, reviveProviderError } from "./remote-addon-provider";

const installation = { id: "inst-1", clientType: WowClientType.Retail } as WowInstallation;

function descriptor(overrides: Partial<AddonProviderDescriptor> = {}): AddonProviderDescriptor {
  return {
    name: "WowUpHub",
    enabled: true,
    forceIgnore: false,
    allowReinstall: true,
    allowChannelChange: true,
    allowEdit: true,
    allowViewAtSource: true,
    allowReScan: true,
    canShowChangelog: true,
    canBatchFetch: true,
    authRequired: false,
    adRequired: false,
    providerNote: "",
    ...overrides,
  };
}

describe("RemoteAddonProvider", () => {
  let api: jasmine.SpyObj<AddonProviderApiService>;
  let provider: RemoteAddonProvider;

  beforeEach(() => {
    api = jasmine.createSpyObj<AddonProviderApiService>("AddonProviderApiService", ["call", "match", "init"]);
    provider = new RemoteAddonProvider(descriptor(), api);
  });

  it("should take its flags from main's descriptor", () => {
    expect(provider.name).toBe("WowUpHub");
    expect(provider.canBatchFetch).toBeTrue();
    expect(provider.forceIgnore).toBeFalse();
  });

  it("should send a url as its string", async () => {
    api.call.and.resolveTo({ ok: true, value: undefined });

    await provider.searchByUrl(new URL("https://wowup.io/addons/31"), installation);

    expect(api.call.calls.mostRecent().args[0]).toEqual({
      providerName: "WowUpHub",
      method: "searchByUrl",
      args: ["https://wowup.io/addons/31", installation],
    });
  });

  it("should throw main's error as the class callers check for", async () => {
    api.call.and.resolveTo({ ok: false, error: { kind: "http", name: "HttpError", message: "x", status: 404 } });

    const error = await provider.getById("31", installation).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect((error as HttpErrorResponse).status).toBe(404);
  });

  it("should copy the scan's matches back onto the caller's folders", async () => {
    const match = { id: "m1", name: "Questie" } as Addon;
    api.call.and.resolveTo({ ok: true, value: [undefined, match] });
    const folders = [{ name: "A" }, { name: "Questie" }] as AddonFolder[];

    await provider.scan(installation, AddonChannelType.Stable, folders);

    expect(folders[0].matchingAddon).toBeUndefined();
    expect(folders[1].matchingAddon).toEqual(match);
  });

  it("should revive the errors inside a getAll result", async () => {
    api.call.and.resolveTo({
      ok: true,
      value: {
        searchResults: [],
        errors: [{ kind: "sourceRemoved", name: "SourceRemovedAddonError", message: "", addonId: "31" }],
      },
    });

    const result = await provider.getAll(installation, ["31"]);

    expect(result.errors[0]).toBeInstanceOf(SourceRemovedAddonError);
    expect((result.errors[0] as SourceRemovedAddonError).addonId).toBe("31");
  });

  it("should refuse the synchronous checks it can't answer", () => {
    expect(() => provider.isValidAddonUri()).toThrowError(/AddonProviderFactory/);
    expect(() => provider.isValidProtocol()).toThrowError(/AddonProviderFactory/);
    expect(() => provider.shouldMigrate()).toThrowError(/AddonProviderFactory/);
  });
});

describe("reviveProviderError", () => {
  it("should rebuild provider errors with their warning type and inner error", () => {
    const error = reviveProviderError({
      kind: "provider",
      name: "GenericProviderError",
      message: "no files",
      warningType: AddonWarningType.NoProviderFiles,
      innerError: { kind: "error", name: "TypeError", message: "inner" },
    });

    expect(error).toBeInstanceOf(GenericProviderError);
    expect((error as GenericProviderError).warningType).toBe(AddonWarningType.NoProviderFiles);
    expect((error as GenericProviderError).innerError?.message).toBe("inner");
  });

  it("should keep the breaker's code on a plain error", () => {
    const error = reviveProviderError({ kind: "error", name: "Error", message: "open", code: "EOPENBREAKER" });

    expect((error as Error & { code?: string }).code).toBe("EOPENBREAKER");
  });

  it("should rebuild GitHub rate limit errors with their limits", () => {
    const error = reviveProviderError({
      kind: "githubLimit",
      name: "GitHubLimitError",
      message: "",
      rateLimit: { max: 60, used: 60, remaining: 0, reset: 1700000000 },
    });

    expect(error).toBeInstanceOf(GitHubLimitError);
    expect((error as GitHubLimitError).rateLimitReset).toBe(1700000000);
  });

  it("should rebuild missing asset errors with their client group", () => {
    const error = reviveProviderError({
      kind: "assetMissing",
      name: "AssetMissingError",
      message: "https://github.com/a/b",
      clientGroup: WowClientGroup.Classic,
    });

    expect(error).toBeInstanceOf(AssetMissingError);
    expect((error as AssetMissingError).clientGroup).toBe(WowClientGroup.Classic);
  });
});

describe("AddonProviderFactory", () => {
  let api: jasmine.SpyObj<AddonProviderApiService>;
  let wowupService: jasmine.SpyObj<WowUpService>;
  let factory: AddonProviderFactory;

  beforeEach(async () => {
    api = jasmine.createSpyObj<AddonProviderApiService>("AddonProviderApiService", ["call", "match", "init"]);
    api.init.and.resolveTo([
      descriptor({ name: "Zip" }),
      descriptor({ name: "Wago", adRequired: true, adPageParams: { pageUrl: "https://ads.test" } }),
      descriptor({ name: "GitHub" }),
    ]);
    wowupService = jasmine.createSpyObj<WowUpService>("WowUpService", ["getAddonProviderState"]);
    wowupService.getAddonProviderState.and.callFake((name: string) =>
      Promise.resolve(name === "Wago" ? { providerName: name, enabled: false, canEdit: true } : undefined),
    );
    factory = new AddonProviderFactory(wowupService, null, api);
    await factory.loadProviders();
  });

  it("should build a stand-in for each provider main has, in the same order", () => {
    expect(factory.getProviderNames()).toEqual(["Zip", "Wago", "GitHub"]);
    expect(factory.getProvider("GitHub")).toBeInstanceOf(RemoteAddonProvider);
  });

  it("should keep the provider state the user saved", () => {
    expect(factory.isProviderAvailable("Wago")).toBeFalse();
    expect(factory.isProviderAvailable("Zip")).toBeTrue();
  });

  it("should serve the ad page params main described", () => {
    expect(factory.getProvider("Wago")?.getAdPageParams()).toEqual({ pageUrl: "https://ads.test" });
  });

  it("should take the first provider, in order, that main says claims a url", async () => {
    api.match.and.resolveTo(["GitHub", "Zip"]);

    const provider = await factory.getAddonProviderForUri(new URL("https://github.com/a/b/releases/x.zip"));

    expect(provider?.name).toBe("Zip");
    expect(api.match.calls.mostRecent().args[0]).toEqual({
      kind: "uri",
      value: "https://github.com/a/b/releases/x.zip",
    });
  });

  it("should skip turned off providers for protocol links", async () => {
    api.match.and.resolveTo(["Wago", "GitHub"]);

    const provider = await factory.getAddonProviderForProtocol("wago-app://addons/abc");

    expect(provider?.name).toBe("GitHub");
  });

  it("should ask main whether its provider wants an addon migrated", async () => {
    api.call.and.resolveTo({ ok: true, value: true });

    expect(await factory.shouldMigrate({ providerName: "Zip" } as Addon)).toBeTrue();
    expect(api.call.calls.mostRecent().args[0]).toEqual({
      providerName: "Zip",
      method: "shouldMigrate",
      args: [{ providerName: "Zip" }],
    });
  });
});
