import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { AddonProvider, AddonProviderType } from "wowup-lib-core";
import { GitHubAddonProvider } from "../../addon-providers/github-addon-provider";
import { RaiderIoAddonProvider } from "../../addon-providers/raiderio-provider";
import { ZipAddonProvider } from "../../addon-providers/zip-provider";
import { WowUpCompanionAddonProvider } from "../../addon-providers/wowup-companion-addon-provider";
import { CachingService } from "../caching/caching-service";
import { ElectronService } from "../electron/electron.service";
import { WowUpService } from "../wowup/wowup.service";
import { NetworkService } from "../network/network.service";
import { FileService } from "../files/file.service";
import { TocService } from "../toc/toc.service";
import { WarcraftService } from "../warcraft/warcraft.service";
import { AddonProviderState } from "../../models/wowup/addon-provider-state";
import { ADDON_PROVIDER_UNKNOWN, WAGO_PROMPT_KEY } from "../../../common/constants";
import { Subject } from "rxjs";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { SensitiveStorageService } from "../storage/sensitive-storage.service";
import { UiMessageService } from "../ui-message/ui-message.service";
import { CurseAddonProvider } from "../../addon-providers/curse-addon-provider";
import { WowUpAddonProvider, WowInterfaceAddonProvider, TukUiAddonProvider } from "wowup-lib-core";
import { AppConfig } from "../../../environments/environment";
import { GenericNetworkInterface } from "../../business-objects/generic-network-interface";
import { WagoAddonProvider } from "../../addon-providers/wago-addon-provider";

@Injectable({
  providedIn: "root",
})
export class AddonProviderFactory {
  private readonly _addonProviderChangeSrc = new Subject<AddonProvider>();

  private _providerMap: Map<string, AddonProvider> = new Map();

  public readonly addonProviderChange$ = this._addonProviderChangeSrc.asObservable();

  private _wowupNetworkInterface: GenericNetworkInterface;
  private _wowInterfaceNetworkInterface: GenericNetworkInterface;
  private _tukuiNetworkInterface: GenericNetworkInterface;

  public constructor(
    private _cachingService: CachingService,
    private _electronService: ElectronService,
    private _httpClient: HttpClient,
    private _wowupService: WowUpService,
    private _networkService: NetworkService,
    private _fileService: FileService,
    private _tocService: TocService,
    private _warcraftService: WarcraftService,

    private _preferenceStorageService: PreferenceStorageService,
    private _sensitiveStorageService: SensitiveStorageService,
    private _uiMessageService: UiMessageService,
  ) {
    this._wowupNetworkInterface = new GenericNetworkInterface(
      this._networkService.getCircuitBreaker(
        "wowup_addon_provider",
        AppConfig.defaultHttpResetTimeoutMs,
        AppConfig.wowUpHubHttpTimeoutMs,
      ),
    );

    this._wowInterfaceNetworkInterface = new GenericNetworkInterface(
      this._networkService.getCircuitBreaker(
        "wow_interface_provider",
        AppConfig.defaultHttpResetTimeoutMs,
        AppConfig.wowUpHubHttpTimeoutMs,
      ),
    );

    this._tukuiNetworkInterface = new GenericNetworkInterface(
      this._networkService.getCircuitBreaker(
        "tukui_provider",
        AppConfig.defaultHttpResetTimeoutMs,
        AppConfig.wowUpHubHttpTimeoutMs,
      ),
    );
  }

  /** This is part of the APP_INITIALIZER and called before the app is bootstrapped */
  public async loadProviders(): Promise<void> {
    if (this._providerMap.size !== 0) {
      return;
    }
    const providers: AddonProvider[] = [
      this.createZipAddonProvider(),
      this.createRaiderIoAddonProvider(),
      this.createWowUpCompanionAddonProvider(),
      this.createWowUpAddonProvider(),
    ];

    if (AppConfig.wago.enabled) {
      providers.push(this.createWagoAddonProvider());
    }

    if (AppConfig.curseforge.enabled) {
      providers.push(this.createCurseProvider());
    }

    providers.push(
      this.createTukUiAddonProvider(),
      this.createWowInterfaceAddonProvider(),
      this.createGitHubAddonProvider(),
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

  public createWowUpCompanionAddonProvider(): WowUpCompanionAddonProvider {
    return new WowUpCompanionAddonProvider(this._fileService, this._tocService);
  }

  public createRaiderIoAddonProvider(): RaiderIoAddonProvider {
    return new RaiderIoAddonProvider(this._tocService);
  }

  public createCurseProvider(): CurseAddonProvider {
    return new CurseAddonProvider(this._cachingService, this._networkService, this._tocService);
  }

  public createTukUiAddonProvider(): TukUiAddonProvider {
    return new TukUiAddonProvider(this._tukuiNetworkInterface);
  }

  public createWowInterfaceAddonProvider(): WowInterfaceAddonProvider {
    return new WowInterfaceAddonProvider(this._wowInterfaceNetworkInterface);
  }

  public createGitHubAddonProvider(): GitHubAddonProvider {
    return new GitHubAddonProvider(this._httpClient, this._sensitiveStorageService);
  }

  public createWowUpAddonProvider(): WowUpAddonProvider {
    return new WowUpAddonProvider(AppConfig.wowUpHubUrl, AppConfig.wowUpWebsiteUrl, this._wowupNetworkInterface);
  }

  public createZipAddonProvider(): ZipAddonProvider {
    return new ZipAddonProvider(this._httpClient, this._fileService, this._tocService, this._warcraftService);
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

  public getAddonProviderForUri(addonUri: URL): AddonProvider | undefined {
    for (const ap of this._providerMap.values()) {
      if (ap.isValidAddonUri(addonUri)) {
        return ap;
      }
    }

    return undefined;
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
