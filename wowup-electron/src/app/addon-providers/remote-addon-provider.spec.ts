import { HttpErrorResponse } from "@angular/common/http";
import {
  Addon,
  AddonChannelType,
  AddonFolder,
  AddonProvider,
  AddonWarningType,
  GenericProviderError,
  SourceRemovedAddonError,
  WowClientType,
  WowInstallation,
} from "wowup-lib-core";

import { AddonProviderDescriptor } from "../../common/models/addon-provider";
import { AddonProviderApiService } from "../services/api/addon-provider-api.service";
import { AddonProviderFactory } from "../services/addons/addon.provider.factory";
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
});

describe("AddonProviderFactory lookups", () => {
  let api: jasmine.SpyObj<AddonProviderApiService>;
  let factory: AddonProviderFactory;
  let local: jasmine.SpyObj<AddonProvider>;
  let remote: RemoteAddonProvider;

  beforeEach(() => {
    api = jasmine.createSpyObj<AddonProviderApiService>("AddonProviderApiService", ["call", "match", "init"]);
    factory = new AddonProviderFactory(null, null, null, null, null, null, null, null, null, null, api);
    remote = new RemoteAddonProvider(descriptor({ name: "Zip" }), api);
    local = jasmine.createSpyObj<AddonProvider>("GitHub", ["isValidAddonUri", "isValidProtocol", "shouldMigrate"]);
    local.name = "GitHub";
    local.enabled = true;
    (factory as unknown as { _providerMap: Map<string, AddonProvider> })._providerMap = new Map<string, AddonProvider>([
      ["Zip", remote],
      ["GitHub", local],
    ]);
  });

  it("should keep the providers' order when main and the renderer both claim a url", async () => {
    api.match.and.resolveTo(["Zip"]);
    local.isValidAddonUri.and.returnValue(true);

    const provider = await factory.getAddonProviderForUri(new URL("https://github.com/a/b/releases/x.zip"));

    expect(provider).toBe(remote);
    expect(api.match.calls.mostRecent().args[0]).toEqual({
      kind: "uri",
      value: "https://github.com/a/b/releases/x.zip",
    });
  });

  it("should fall through to a renderer provider main's don't claim", async () => {
    api.match.and.resolveTo([]);
    local.isValidAddonUri.and.returnValue(true);

    expect(await factory.getAddonProviderForUri(new URL("https://github.com/a/b"))).toBe(local);
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
