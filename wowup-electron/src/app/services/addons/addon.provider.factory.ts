import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Addon, AddonProvider, AddonProviderType } from "wowup-lib-core";
import { Subject } from "rxjs";

import { CachingService } from "../caching/caching-service";
import { ElectronService } from "../electron/electron.service";
import { WowUpService } from "../wowup/wowup.service";
import { NetworkService } from "../network/network.service";
import { TocService } from "../toc/toc.service";
import { WarcraftService } from "../warcraft/warcraft.service";
import { AddonProviderState } from "../../models/wowup/addon-provider-state";
import {
  ADDON_PROVIDER_HUB,
  ADDON_PROVIDER_RAIDERIO,
  ADDON_PROVIDER_TUKUI,
  ADDON_PROVIDER_UNKNOWN,
  ADDON_PROVIDER_WOWINTERFACE,
  ADDON_PROVIDER_WOWUP_COMPANION,
  ADDON_PROVIDER_ZIP,
  WAGO_PROMPT_KEY,
} from "../../../common/constants";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { SensitiveStorageService } from "../storage/sensitive-storage.service";
import { UiMessageService } from "../ui-message/ui-message.service";
import { CurseAddonProvider } from "../../addon-providers/curse-addon-provider";
import { GitHubAddonProvider } from "../../addon-providers/github-addon-provider";
import { RemoteAddonProvider } from "../../addon-providers/remote-addon-provider";
import { WagoAddonProvider } from "../../addon-providers/wago-addon-provider";
import { AppConfig } from "../../../environments/environment";
import { AddonProviderDescriptor } from "../../../common/models/addon-provider";
import { AddonProviderApiService } from "../api/addon-provider-api.service";

@Injectable({
  providedIn: "root",
})
export class AddonProviderFactory {
  private readonly _addonProviderChangeSrc = new Subject<AddonProvider>();

  private _providerMap: Map<string, AddonProvider> = new Map();

  public readonly addonProviderChange$ = this._addonProviderChangeSrc.asObservable();

  public constructor(
    private _cachingService: CachingService,
    private _electronService: ElectronService,
    private _httpClient: HttpClient,
    private _wowupService: WowUpService,
    private _networkService: NetworkService,
    private _tocService: TocService,
    private _warcraftService: WarcraftService,

    private _preferenceStorageService: PreferenceStorageService,
    private _sensitiveStorageService: SensitiveStorageService,
    private _uiMessageService: UiMessageService,
    private _addonProviderApiService: AddonProviderApiService,
  ) {}

  /** This is part of the APP_INITIALIZER and called before the app is bootstrapped */
  public async loadProviders(): Promise<void> {
    if (this._providerMap.size !== 0) {
      return;
    }

    // These run in main now (UI_DECOUPLING_PLAN.md, Phase 5b); the renderer keeps a stand-in for each
    const descriptors = await this._addonProviderApiService.init({
      wowUpHubUrl: AppConfig.wowUpHubUrl,
      wowUpWebsiteUrl: AppConfig.wowUpWebsiteUrl,
      defaultHttpTimeoutMs: AppConfig.defaultHttpTimeoutMs,
      defaultHttpResetTimeoutMs: AppConfig.defaultHttpResetTimeoutMs,
      wowUpHubHttpTimeoutMs: AppConfig.wowUpHubHttpTimeoutMs,
    });
    const remote = (name: string) => this.createRemoteProvider(descriptors, name);

    const providers: AddonProvider[] = [
      remote(ADDON_PROVIDER_ZIP),
      remote(ADDON_PROVIDER_RAIDERIO),
      remote(ADDON_PROVIDER_WOWUP_COMPANION),
      remote(ADDON_PROVIDER_HUB),
    ];

    if (AppConfig.wago.enabled) {
      providers.push(this.createWagoAddonProvider());
    }

    if (AppConfig.curseforge.enabled) {
      providers.push(this.createCurseProvider());
    }

    providers.push(remote(ADDON_PROVIDER_TUKUI), remote(ADDON_PROVIDER_WOWINTERFACE), this.createGitHubAddonProvider());

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

  public createWagoAddonProvider(): WagoAddonProvider {
    return new WagoAddonProvider(
      this._electronService,
      this._cachingService,
      this._warcraftService,
      this._tocService,
      this._uiMessageService,
      this._sensitiveStorageService,
      this._networkService,
    );
  }

  public createCurseProvider(): CurseAddonProvider {
    return new CurseAddonProvider(this._cachingService, this._networkService, this._tocService);
  }

  public createGitHubAddonProvider(): GitHubAddonProvider {
    return new GitHubAddonProvider(this._httpClient, this._sensitiveStorageService);
  }

  private createRemoteProvider(descriptors: AddonProviderDescriptor[], name: string): RemoteAddonProvider {
    const descriptor = descriptors.find((d) => d.name === name);
    if (!descriptor) {
      throw new Error(`Main has no addon provider ${name}`);
    }
    return new RemoteAddonProvider(descriptor, this._addonProviderApiService);
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
    const claimedInMain = new Set(
      await this._addonProviderApiService.match({ kind: "uri", value: addonUri.toString() }),
    );
    return [...this._providerMap.values()].find((ap) =>
      ap instanceof RemoteAddonProvider ? claimedInMain.has(ap.name) : ap.isValidAddonUri(addonUri),
    );
  }

  public async getAddonProviderForProtocol(protocol: string): Promise<AddonProvider | undefined> {
    const claimedInMain = new Set(await this._addonProviderApiService.match({ kind: "protocol", value: protocol }));
    return this.getEnabledAddonProviders().find((ap) =>
      ap instanceof RemoteAddonProvider ? claimedInMain.has(ap.name) : ap.isValidProtocol(protocol),
    );
  }

  /** Whether the addon's provider wants it re-matched, e.g. a hub addon saved without its release id */
  public async shouldMigrate(addon: Addon): Promise<boolean> {
    const provider = this.getProvider(addon.providerName ?? "");
    if (provider instanceof RemoteAddonProvider) {
      return await provider.shouldMigrateAsync(addon);
    }
    return provider?.shouldMigrate(addon) ?? false;
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
