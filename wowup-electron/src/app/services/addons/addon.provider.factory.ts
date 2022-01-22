import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { AddonProvider, AddonProviderType } from "../../addon-providers/addon-provider";
import { CurseAddonProvider } from "../../addon-providers/curse-addon-provider";
import { GitHubAddonProvider } from "../../addon-providers/github-addon-provider";
import { TukUiAddonProvider } from "../../addon-providers/tukui-addon-provider";
import { WowInterfaceAddonProvider } from "../../addon-providers/wow-interface-addon-provider";
import { WowUpAddonProvider } from "../../addon-providers/wowup-addon-provider";
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
import { WowUpApiService } from "../wowup-api/wowup-api.service";
import { WagoAddonProvider } from "../../addon-providers/wago-addon-provider";
import { AddonProviderState } from "../../models/wowup/addon-provider-state";
import { ADDON_PROVIDER_UNKNOWN, WAGO_PROMPT_KEY } from "../../../common/constants";
import { Subject } from "rxjs";
import { PreferenceStorageService } from "../storage/preference-storage.service";

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
    private _fileService: FileService,
    private _tocService: TocService,
    private _warcraftService: WarcraftService,
    private _wowupApiService: WowUpApiService,
    private _preferenceStorageService: PreferenceStorageService
  ) {}

  /** This is part of the APP_INITIALIZER and called before the app is bootstrapped */
  public async loadProviders(): Promise<void> {
    if (this._providerMap.size !== 0) {
      return;
    }
    const providers = [
      this.createZipAddonProvider(),
      this.createRaiderIoAddonProvider(),
      this.createWowUpCompanionAddonProvider(),
      this.createWowUpAddonProvider(),
      this.createWagoAddonProvider(),
      this.createCurseAddonProvider(),
      this.createTukUiAddonProvider(),
      this.createWowInterfaceAddonProvider(),
      this.createGitHubAddonProvider(),
    ];

    for (const provider of providers) {
      await this.setProviderState(provider);
      this._providerMap.set(provider.name, provider);
    }
  }

  public async shouldShowConsentDialog(): Promise<boolean> {
    return (await this._preferenceStorageService.getAsync(WAGO_PROMPT_KEY)) === undefined;
  }

  public async updateWagoConsent(): Promise<void> {
    return await this._preferenceStorageService.setAsync(WAGO_PROMPT_KEY, true);
  }

  public async setProviderEnabled(type: AddonProviderType, enabled: boolean): Promise<void> {
    if (!this._providerMap.has(type)) {
      throw new Error("cannot set provider state, not found");
    }

    const provider = this._providerMap.get(type);
    if (!provider.allowEdit) {
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
      this._networkService
    );
  }

  public createWowUpCompanionAddonProvider(): WowUpCompanionAddonProvider {
    return new WowUpCompanionAddonProvider(this._fileService, this._tocService);
  }

  public createRaiderIoAddonProvider(): RaiderIoAddonProvider {
    return new RaiderIoAddonProvider(this._tocService);
  }

  public createCurseAddonProvider(): CurseAddonProvider {
    return new CurseAddonProvider(
      this._cachingService,
      this._electronService,
      this._wowupApiService,
      this._tocService,
      this._networkService
    );
  }

  public createTukUiAddonProvider(): TukUiAddonProvider {
    return new TukUiAddonProvider(this._cachingService, this._networkService, this._tocService);
  }

  public createWowInterfaceAddonProvider(): WowInterfaceAddonProvider {
    return new WowInterfaceAddonProvider(this._cachingService, this._networkService, this._tocService);
  }

  public createGitHubAddonProvider(): GitHubAddonProvider {
    return new GitHubAddonProvider(this._httpClient, this._warcraftService);
  }

  public createWowUpAddonProvider(): WowUpAddonProvider {
    return new WowUpAddonProvider(this._electronService, this._cachingService, this._networkService);
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
