import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { AddonProvider } from "../../addon-providers/addon-provider";
import { CurseAddonProvider } from "../../addon-providers/curse-addon-provider";
import { GitHubAddonProvider } from "../../addon-providers/github-addon-provider";
import { TukUiAddonProvider } from "../../addon-providers/tukui-addon-provider";
import { WowInterfaceAddonProvider } from "../../addon-providers/wow-interface-addon-provider";
import { WowUpAddonProvider } from "../../addon-providers/wowup-addon-provider";
import { RaiderIoAddonProvider } from "../../addon-providers/raiderio-provider";
import { ZipAddonProvider } from "../../addon-providers/zip-provider";
import { CachingService } from "../caching/caching-service";
import { ElectronService } from "../electron/electron.service";
import { WowUpService } from "../wowup/wowup.service";
import { NetworkService } from "../network/network.service";
import { FileService } from "../files/file.service";
import { TocService } from "../toc/toc.service";
import { WarcraftService } from "../warcraft/warcraft.service";
import { WowUpApiService } from "../wowup-api/wowup-api.service";

@Injectable({
  providedIn: "root",
})
export class AddonProviderFactory {
  private _providers: AddonProvider[] = [];

  constructor(
    private _cachingService: CachingService,
    private _electronService: ElectronService,
    private _httpClient: HttpClient,
    private _wowupService: WowUpService,
    private _networkService: NetworkService,
    private _fileService: FileService,
    private _tocService: TocService,
    private _warcraftService: WarcraftService,
    private _wowupApiService: WowUpApiService
  ) {}

  public createRaiderIoAddonProvider(): RaiderIoAddonProvider {
    return new RaiderIoAddonProvider();
  }

  public createCurseAddonProvider(): CurseAddonProvider {
    return new CurseAddonProvider(
      this._cachingService,
      this._electronService,
      this._wowupApiService,
      this._networkService
    );
  }

  public createTukUiAddonProvider(): TukUiAddonProvider {
    return new TukUiAddonProvider(this._cachingService, this._networkService);
  }

  public createWowInterfaceAddonProvider(): WowInterfaceAddonProvider {
    return new WowInterfaceAddonProvider(this._cachingService, this._networkService);
  }

  public createGitHubAddonProvider(): GitHubAddonProvider {
    return new GitHubAddonProvider(this._httpClient);
  }

  public createWowUpAddonProvider(): WowUpAddonProvider {
    return new WowUpAddonProvider(this._electronService, this._cachingService, this._networkService);
  }

  public createZipAddonProvider(): ZipAddonProvider {
    return new ZipAddonProvider(this._httpClient, this._fileService, this._tocService, this._warcraftService);
  }

  public getAll(): AddonProvider[] {
    if (this._providers.length === 0) {
      this._providers = [
        this.createZipAddonProvider(),
        this.createRaiderIoAddonProvider(),
        this.createWowUpAddonProvider(),
        this.createCurseAddonProvider(),
        this.createTukUiAddonProvider(),
        this.createWowInterfaceAddonProvider(),
        this.createGitHubAddonProvider(),
      ];

      this._providers.forEach(this.setProviderState);
    }

    return this._providers;
  }

  private setProviderState = (provider: AddonProvider) => {
    const state = this._wowupService.getAddonProviderState(provider.name);
    if (state) {
      provider.enabled = state.enabled;
    }
  };
}
