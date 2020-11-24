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
import { FileService } from "../files/file.service";

@Injectable({
  providedIn: "root",
})
export class AddonProviderFactory {
  constructor(
    private _cachingService: CachingService,
    private _electronService: ElectronService,
    private _httpClient: HttpClient,
    private _fileService: FileService
  ) {}

  public getAddonProvider<T extends object>(providerType: T & AddonProvider) {
    switch (providerType.name) {
      case CurseAddonProvider.name:
        return this.createCurseAddonProvider();
      case TukUiAddonProvider.name:
        break;
      default:
        break;
    }
  }

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
}
