import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { AddonProvider } from "../../addon-providers/addon-provider";
import { CurseAddonProvider } from "../../addon-providers/curse-addon-provider";
import { GitHubAddonProvider } from "../../addon-providers/github-addon-provider";
import { TukUiAddonProvider } from "../../addon-providers/tukui-addon-provider";
import { WowInterfaceAddonProvider } from "../../addon-providers/wow-interface-addon-provider";
import { WowUpAddonProvider } from "../../addon-providers/wowup-addon-provider";
import { CachingService } from "../caching/caching-service";
import { ElectronService } from "../electron/electron.service";
import { WowUpService } from "../wowup/wowup.service";
import { FileService } from "../files/file.service";

@Injectable({
  providedIn: "root",
})
export class AddonProviderFactory {
  private _providers: AddonProvider[] = [];

  constructor(
    private _cachingService: CachingService,
    private _electronService: ElectronService,
    private _httpClient: HttpClient,
    private _fileService: FileService,
    private _wowupService: WowUpService
  ) {}

  public createCurseAddonProvider(): CurseAddonProvider {
    return new CurseAddonProvider(this._httpClient, this._cachingService, this._electronService);
  }

  public createTukUiAddonProvider(): TukUiAddonProvider {
    return new TukUiAddonProvider(this._httpClient, this._cachingService, this._electronService, this._fileService);
  }

  public createWowInterfaceAddonProvider(): WowInterfaceAddonProvider {
    return new WowInterfaceAddonProvider(
      this._httpClient,
      this._cachingService,
      this._electronService,
      this._fileService
    );
  }

  public createGitHubAddonProvider(): GitHubAddonProvider {
    return new GitHubAddonProvider(this._httpClient);
  }

  public createWowUpAddonProvider(): WowUpAddonProvider {
    return new WowUpAddonProvider(this._httpClient, this._electronService);
  }

  public getAll(): AddonProvider[] {
    if (this._providers.length === 0) {
      this._providers = [
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
    console.debug("STATE", state);
    if (state) {
      provider.enabled = state.enabled;
    }
  };
}
