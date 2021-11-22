import { ADDON_PROVIDER_WAGO } from "../../common/constants";
import { AppConfig } from "../../environments/environment";
import { ElectronService } from "../services";
import { WarcraftService } from "../services/warcraft/warcraft.service";
import { CachingService } from "../services/caching/caching-service";
import { CircuitBreakerWrapper, NetworkService } from "../services/network/network.service";
import { AddonProvider } from "./addon-provider";
import { WowInstallation } from "../../common/warcraft/wow-installation";
import { AddonChannelType } from "../../common/wowup/models";
import { AddonFolder } from "../models/wowup/addon-folder";
import { WowClientGroup, WowClientType } from "../../common/warcraft/wow-client-type";
import { AppWowUpScanResult } from "../models/wowup/app-wowup-scan-result";
import { TocService } from "../services/toc/toc.service";

declare type WagoGameVersion = "retail" | "classic" | "bcc";

interface WagoFingerprintAddon {
  hash: string; // hash fingerprint of the folder
  cf?: string; // curseforge toc id
  wowi?: string; // wow interface toc id
  wago?: string; // wago interface toc id
}

interface WagoFingerprintRequest {
  game_version: WagoGameVersion;
  addons: { [folder: string]: WagoFingerprintAddon };
}

export class WagoAddonProvider extends AddonProvider {
  private readonly _circuitBreaker: CircuitBreakerWrapper;

  public readonly name = ADDON_PROVIDER_WAGO;
  public readonly forceIgnore = false;
  public enabled = true;

  public constructor(
    private _electronService: ElectronService,
    private _cachingService: CachingService,
    private _networkService: NetworkService,
    private _warcraftService: WarcraftService,
    private _tocService: TocService
  ) {
    super();

    this._circuitBreaker = _networkService.getCircuitBreaker(
      `${this.name}_main`,
      AppConfig.defaultHttpResetTimeoutMs,
      AppConfig.wagoHttpTimeoutMs
    );
  }

  public async scan(
    installation: WowInstallation,
    addonChannelType: AddonChannelType,
    addonFolders: AddonFolder[]
  ): Promise<void> {
    const gameVersion = this.getGameVersion(installation.clientType);

    console.time("WagoScan");
    const scanResults = await this.getScanResults(addonFolders);
    console.timeEnd("WagoScan");

    const request: WagoFingerprintRequest = {
      game_version: gameVersion,
      addons: {},
    };

    scanResults.forEach((res) => {
      const addonFolder = addonFolders.find((af) => af.name === res.folderName);
      const toc = this._tocService.getTocForGameType2(addonFolder, installation.clientType);

      const waddon: WagoFingerprintAddon = {
        hash: res.fingerprint,
      };

      if (toc.wagoAddonId) {
        waddon.wago = toc.wagoAddonId;
      }

      request.addons[res.folderName] = waddon;
    });

    console.debug(`[wago] scan`, request);
    console.debug(JSON.stringify(request, null, 2));
  }

  // The wago name for the client type
  private getGameVersion(clientType: WowClientType): WagoGameVersion {
    const clientGroup = this._warcraftService.getClientGroup(clientType);
    switch (clientGroup) {
      case WowClientGroup.BurningCrusade:
        return "bcc";
      case WowClientGroup.Classic:
        return "classic";
      case WowClientGroup.Retail:
        return "retail";
      default:
        throw new Error(`[wago] Un-handled client type: ${clientType}`);
    }
  }

  // Scan the actual folders, luckily wago uses the same fingerprint method as wowup
  private getScanResults = async (addonFolders: AddonFolder[]): Promise<AppWowUpScanResult[]> => {
    const filePaths = addonFolders.map((addonFolder) => addonFolder.path);
    const scanResults: AppWowUpScanResult[] = await this._electronService.invoke("wowup-get-scan-results", filePaths);
    return scanResults;
  };
}
