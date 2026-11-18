import { Injectable } from "@angular/core";
import { Addon, AddonProvider, AddonProviderType } from "wowup-lib-core";
import { Subject } from "rxjs";

import { WowUpService } from "../wowup/wowup.service";
import { AddonProviderState } from "../../models/wowup/addon-provider-state";
import { ADDON_PROVIDER_UNKNOWN, WAGO_PROMPT_KEY } from "../../../common/constants";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { RemoteAddonProvider } from "../../addon-providers/remote-addon-provider";
import { AppConfig } from "../../../environments/environment";
import { AddonProviderApiService } from "../api/addon-provider-api.service";

@Injectable({
  providedIn: "root",
})
export class AddonProviderFactory {
  private readonly _addonProviderChangeSrc = new Subject<AddonProvider>();

  private _providerMap: Map<string, RemoteAddonProvider> = new Map();

  public readonly addonProviderChange$ = this._addonProviderChangeSrc.asObservable();

  public constructor(
    private _wowupService: WowUpService,
    private _preferenceStorageService: PreferenceStorageService,
    private _addonProviderApiService: AddonProviderApiService,
  ) {}

  /** This is part of the APP_INITIALIZER and called before the app is bootstrapped */
  public async loadProviders(): Promise<void> {
    if (this._providerMap.size !== 0) {
      return;
    }

    // Every provider runs in main (UI_DECOUPLING_PLAN.md, Phase 5b); the renderer keeps a stand-in for each,
    // in main's order, which is the order lookups go through them
    const descriptors = await this._addonProviderApiService.init({
      wowUpHubUrl: AppConfig.wowUpHubUrl,
      wowUpWebsiteUrl: AppConfig.wowUpWebsiteUrl,
      defaultHttpTimeoutMs: AppConfig.defaultHttpTimeoutMs,
      defaultHttpResetTimeoutMs: AppConfig.defaultHttpResetTimeoutMs,
      wowUpHubHttpTimeoutMs: AppConfig.wowUpHubHttpTimeoutMs,
      wagoHttpTimeoutMs: AppConfig.wagoHttpTimeoutMs,
      featuredAddonsCacheTimeSec: AppConfig.featuredAddonsCacheTimeSec,
      wago: { enabled: AppConfig.wago.enabled },
      curseforge: {
        enabled: AppConfig.curseforge.enabled,
        apiKey: AppConfig.curseforge.apiKey,
        httpTimeoutMs: AppConfig.curseforge.httpTimeoutMs,
      },
    });
    const providers = descriptors.map(
      (descriptor) => new RemoteAddonProvider(descriptor, this._addonProviderApiService),
    );

    for (const provider of providers) {
      await this.setProviderState(provider);
      this._providerMap.set(provider.name, provider);
    }
  }

  public async shouldShowConsentDialog(): Promise<boolean> {
    if (AppConfig.wago.enabled) {
      return (await this._preferenceStorageService.getAsync(WAGO_PROMPT_KEY)) === undefined;
    }
    return false;
  }

  public async updateWagoConsent(): Promise<void> {
    return await this._preferenceStorageService.setAsync(WAGO_PROMPT_KEY, true);
  }

  public async setProviderEnabled(type: AddonProviderType, enabled: boolean): Promise<void> {
    if (!this._providerMap.has(type)) {
      throw new Error(`cannot set provider state, not found: ${type}`);
    }

    const provider = this._providerMap.get(type);
    if (!provider || !provider.allowEdit) {
      throw new Error(`this provider is not editable: ${type}`);
    }

    await this._wowupService.setAddonProviderState({
      providerName: type,
      enabled: enabled,
      canEdit: true,
    });

    provider.enabled = enabled;
    this._addonProviderChangeSrc.next(provider);
  }

  public getProvider<T = AddonProvider>(providerName: string): T | undefined {
    if (!providerName || !this.hasProvider(providerName)) {
      return undefined;
    }

    return this._providerMap.get(providerName) as any;
  }

  public hasProvider(providerName: string): boolean {
    return this._providerMap.has(providerName);
  }

  /** Every provider this build has, enabled or not */
  public getProviderNames(): string[] {
    return [...this._providerMap.keys()];
  }

  /** Providers whose addons a scan can't find again from the folders on disk, e.g. GitHub */
  public getNonRescanProviderNames(): string[] {
    return [...this._providerMap.values()].filter((ap) => ap.allowReScan !== true).map((ap) => ap.name);
  }

  public async getAddonProviderForUri(addonUri: URL): Promise<AddonProvider | undefined> {
    const claimed = new Set(await this._addonProviderApiService.match({ kind: "uri", value: addonUri.toString() }));
    return [...this._providerMap.values()].find((ap) => claimed.has(ap.name));
  }

  public async getAddonProviderForProtocol(protocol: string): Promise<AddonProvider | undefined> {
    const claimed = new Set(await this._addonProviderApiService.match({ kind: "protocol", value: protocol }));
    return this.getEnabledAddonProviders().find((ap) => claimed.has(ap.name));
  }

  /** Whether the addon's provider wants it re-matched, e.g. a hub addon saved without its release id */
  public async shouldMigrate(addon: Addon): Promise<boolean> {
    const provider = this._providerMap.get(addon.providerName ?? "");
    return provider ? await provider.shouldMigrateAsync(addon) : false;
  }

  /** Registered in this build and not turned off by the user */
  public isProviderAvailable(providerName: string): boolean {
    return this.getProvider(providerName)?.enabled === true;
  }

  public getEnabledAddonProviders(): AddonProvider[] {
    const providers: AddonProvider[] = [];

    this._providerMap.forEach((ap) => {
      if (ap.enabled) {
        providers.push(ap);
      }
    });

    return providers;
  }

  public getBatchAddonProviders(): AddonProvider[] {
    const providers: AddonProvider[] = [];

    this._providerMap.forEach((ap) => {
      if (ap.enabled && ap.canBatchFetch) {
        providers.push(ap);
      }
    });

    return providers;
  }

  public getStandardAddonProviders(): AddonProvider[] {
    const providers: AddonProvider[] = [];

    this._providerMap.forEach((ap) => {
      if (ap.enabled && !ap.canBatchFetch) {
        providers.push(ap);
      }
    });

    return providers;
  }

  public getAdRequiredProviders(): AddonProvider[] {
    const providers: AddonProvider[] = [];

    this._providerMap.forEach((ap) => {
      if (ap.enabled && ap.adRequired) {
        providers.push(ap);
      }
    });

    return providers;
  }

  public getAddonProviderStates(): AddonProviderState[] {
    const states: AddonProviderState[] = [];

    this._providerMap.forEach((ap) => {
      states.push({
        providerName: ap.name,
        enabled: ap.enabled,
        canEdit: ap.allowEdit,
      });
    });

    return states;
  }

  public canShowChangelog(providerName: string | undefined): boolean {
    if (providerName === undefined) {
      return false;
    }

    return this.getProvider(providerName)?.canShowChangelog ?? false;
  }

  public isForceIgnore(providerName: string): boolean {
    const provider = this.getProvider(providerName);
    if (!provider) {
      return false;
    }

    return providerName === ADDON_PROVIDER_UNKNOWN || (provider?.forceIgnore ?? false);
  }

  public canReinstall(providerName: string): boolean {
    const provider = this.getProvider(providerName);
    if (!provider) {
      return false;
    }

    return providerName !== ADDON_PROVIDER_UNKNOWN && (provider?.allowReinstall ?? false);
  }

  public canChangeChannel(providerName: string): boolean {
    const provider = this.getProvider(providerName);
    if (!provider) {
      return false;
    }

    return providerName !== ADDON_PROVIDER_UNKNOWN && (provider?.allowChannelChange ?? false);
  }

  private setProviderState = async (provider: AddonProvider): Promise<void> => {
    const state = await this._wowupService.getAddonProviderState(provider.name);
    if (state) {
      provider.enabled = state.enabled;
    }
  };
}
