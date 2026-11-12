import NodeCache = require("node-cache");
import { AddonFolder, AddonProvider, GetAllBatchResult, GetAllResult, Toc, WowInstallation } from "wowup-lib-core";

import {
  ADDON_PROVIDER_METHODS,
  AddonProviderCallRequest,
  AddonProviderCallResult,
  AddonProviderConfig,
  AddonProviderDescriptor,
  AddonProviderMatchRequest,
  AddonProviderMethod,
} from "../../../src/common/models/addon-provider";
import { HttpCircuitBreaker } from "../network/circuit-breaker";
import { FetchFn, HttpClient } from "../network/http-client";
import { ProviderNetworkInterface } from "../network/provider-network-interface";
import { serializeProviderError } from "./provider-errors";
import { RaiderIoAddonProvider } from "./raiderio-provider";
import { TukUiAddonProvider } from "./tukui-addon-provider";
import { WowInterfaceAddonProvider } from "./wow-interface-addon-provider";
import { WowUpAddonProvider } from "./wowup-addon-provider";
import { WowUpCompanionAddonProvider } from "./wowup-companion-addon-provider";
import { ZipAddonProvider } from "./zip-provider";

export interface AddonProviderRegistryDeps {
  config: AddonProviderConfig;
  fetch: FetchFn;
  /** Sent to the hub on every request, as the renderer did */
  installId: string;
  platform: string;
  getAddonFolderPath: (installation: WowInstallation) => string;
  listTocFiles: (dirPath: string) => Promise<string[]>;
  parseToc: (tocPath: string) => Promise<Toc>;
  getLatestDirUpdateTime: (dirPath: string) => Promise<number>;
  newId: () => string;
  log: { info(...args: unknown[]): void; error(...args: unknown[]): void };
}

/**
 * The addon providers that run in main. The renderer reaches them through `RemoteAddonProvider`
 * stand-ins, one ipc call per provider method; the rest of the providers are still in the renderer
 * (see UI_DECOUPLING_PLAN.md, Phase 5b).
 */
export class AddonProviderRegistry {
  private readonly _providers = new Map<string, AddonProvider>();

  public constructor(private readonly _deps: AddonProviderRegistryDeps) {
    const { config, log } = _deps;
    const http = new HttpClient({ fetch: _deps.fetch, log });
    const cache = new NodeCache();
    const network = (name: string, defaultHeaders?: Record<string, string>) =>
      new ProviderNetworkInterface(
        new HttpCircuitBreaker(http, {
          name,
          resetTimeoutMs: config.defaultHttpResetTimeoutMs,
          httpTimeoutMs: config.wowUpHubHttpTimeoutMs,
          log,
        }),
        cache,
        defaultHeaders,
      );

    const providers: AddonProvider[] = [
      new ZipAddonProvider({
        head: (url) => http.head(url, config.defaultHttpTimeoutMs),
        getAddonFolderPath: _deps.getAddonFolderPath,
        listTocFiles: _deps.listTocFiles,
        parseToc: _deps.parseToc,
      }),
      new RaiderIoAddonProvider(_deps.newId),
      new WowUpCompanionAddonProvider({
        getLatestDirUpdateTime: _deps.getLatestDirUpdateTime,
        newId: _deps.newId,
      }),
      new WowUpAddonProvider(
        config.wowUpHubUrl,
        config.wowUpWebsiteUrl,
        network("wowup_addon_provider", {
          "X-WowUp-Install-Id": _deps.installId,
          "X-WowUp-Platform": _deps.platform,
        }),
      ),
      new TukUiAddonProvider(network("tukui_provider")),
      new WowInterfaceAddonProvider(network("wow_interface_provider")),
    ];

    for (const provider of providers) {
      this._providers.set(provider.name, provider);
    }
  }

  public getDescriptors(): AddonProviderDescriptor[] {
    return [...this._providers.values()].map((provider) => ({
      name: provider.name,
      enabled: provider.enabled,
      forceIgnore: provider.forceIgnore,
      allowReinstall: provider.allowReinstall,
      allowChannelChange: provider.allowChannelChange,
      allowEdit: provider.allowEdit,
      allowViewAtSource: provider.allowViewAtSource,
      allowReScan: provider.allowReScan,
      canShowChangelog: provider.canShowChangelog,
      canBatchFetch: provider.canBatchFetch,
      authRequired: provider.authRequired,
      adRequired: provider.adRequired,
      providerNote: provider.providerNote,
    }));
  }

  /** The providers here, in order, that claim the url or protocol link */
  public match(request: AddonProviderMatchRequest): string[] {
    const matches: string[] = [];
    for (const provider of this._providers.values()) {
      try {
        const claimed =
          request.kind === "uri"
            ? provider.isValidAddonUri(new URL(request.value))
            : provider.isValidProtocol(request.value);
        if (claimed) {
          matches.push(provider.name);
        }
      } catch {
        // Not a url this provider (or anyone) can read
      }
    }
    return matches;
  }

  /**
   * Runs one provider method. Never rejects: a failure comes back as a serialized error so the
   * renderer can rebuild its class, which ipc would otherwise drop.
   */
  public async call(request: AddonProviderCallRequest): Promise<AddonProviderCallResult> {
    try {
      const value = await this.invoke(request);
      return { ok: true, value };
    } catch (e) {
      this._deps.log.error(`[AddonProvider] ${request.providerName}.${request.method} failed`, e);
      return { ok: false, error: serializeProviderError(e) };
    }
  }

  private async invoke({ providerName, method, args }: AddonProviderCallRequest): Promise<unknown> {
    if (!(ADDON_PROVIDER_METHODS as readonly string[]).includes(method)) {
      throw new Error(`Not a provider method: ${method}`);
    }

    const provider = this._providers.get(providerName);
    if (!provider) {
      throw new Error(`Addon provider not found: ${providerName}`);
    }

    const fn = (provider as unknown as Record<AddonProviderMethod, unknown>)[method];
    if (typeof fn !== "function") {
      throw new Error(`${providerName} has no ${method}`);
    }

    const callArgs = [...(args ?? [])];
    if (method === "searchByUrl") {
      callArgs[0] = new URL(callArgs[0] as string);
    }

    const result: unknown = await fn.apply(provider, callArgs);

    switch (method) {
      // scan fills in each folder's matchingAddon, which the caller's copies never see
      case "scan":
        return (callArgs[2] as AddonFolder[]).map((folder) => folder.matchingAddon);
      // These carry errors inside the result, which need the same treatment as thrown ones
      case "getAll": {
        const getAll = result as GetAllResult;
        return { ...getAll, errors: getAll.errors.map(serializeProviderError) };
      }
      case "getAllBatch": {
        const batch = result as GetAllBatchResult;
        const errors: Record<string, unknown[]> = {};
        for (const [installationId, installationErrors] of Object.entries(batch.errors)) {
          errors[installationId] = installationErrors.map(serializeProviderError);
        }
        return { ...batch, errors };
      }
      default:
        return result;
    }
  }
}
