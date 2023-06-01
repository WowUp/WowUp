import * as path from "path";
import { BehaviorSubject } from "rxjs";
import { filter, map } from "rxjs/operators";

import { Injectable } from "@angular/core";

import { ElectronService } from "../electron/electron.service";
import * as constants from "../../../common/constants";
import { SelectItem } from "../../models/wowup/select-item";
import { getEnumName, getEnumList } from "wowup-lib-core/lib/utils";
import { FileService } from "../files/file.service";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { TocService } from "../toc/toc.service";
import { WarcraftServiceImpl } from "./warcraft.service.impl";
import { WarcraftServiceLinux } from "./warcraft.service.linux";
import { WarcraftServiceMac } from "./warcraft.service.mac";
import { WarcraftServiceWin } from "./warcraft.service.win";
import { ProductDb } from "../../../common/wowup/product-db";
import { AddonFolder, Toc, WowClientType } from "wowup-lib-core";
import { InstalledProduct, WowInstallation } from "wowup-lib-core/lib/models";

@Injectable({
  providedIn: "root",
})
export class WarcraftService {
  private readonly _impl: WarcraftServiceImpl;
  private readonly _productsSrc = new BehaviorSubject<InstalledProduct[]>([]);
  private readonly _installedClientTypesSrc = new BehaviorSubject<WowClientType[] | undefined>(undefined);
  private readonly _allClientTypes = getEnumList<WowClientType>(WowClientType).filter(
    (clientType) => clientType !== WowClientType.None
  );

  public readonly products$ = this._productsSrc.asObservable();
  public readonly productsReady$ = this.products$.pipe(filter((products) => Array.isArray(products)));
  public readonly installedClientTypes$ = this._installedClientTypesSrc.asObservable();

  // Map the client types so that we can localize them
  public installedClientTypesSelectItems$ = this._installedClientTypesSrc.pipe(
    filter((clientTypes) => clientTypes !== undefined),
    map((clientTypes) => {
      if (clientTypes === undefined) {
        return [];
      }

      return clientTypes.map((ct): SelectItem<WowClientType> => {
        const clientTypeName = getEnumName(WowClientType, ct).toUpperCase();
        return {
          display: `COMMON.CLIENT_TYPES.${clientTypeName}`,
          value: ct,
        };
      });
    })
  );

  public constructor(
    private _electronService: ElectronService,
    private _fileService: FileService,
    private _preferenceStorageService: PreferenceStorageService,
    private _tocService: TocService
  ) {
    this._impl = this.getImplementation();
  }

  public getExecutableName(clientType: WowClientType): string {
    return this._impl.getExecutableName(clientType);
  }

  public getExecutableExtension(): string {
    return this._impl.getExecutableExtension();
  }

  public async isWowApplication(appPath: string): Promise<boolean> {
    const pathExists = await this._fileService.pathExists(appPath);
    if (!pathExists) {
      return false;
    }

    const fileName = path.basename(appPath);
    return this._impl.isWowApplication(fileName);
  }

  public getAllClientTypes(): WowClientType[] {
    return [...this._allClientTypes];
  }

  public getProductLocation(
    clientType: WowClientType,
    installedProducts: Map<WowClientType, InstalledProduct>
  ): string {
    const clientLocation = installedProducts.get(clientType);
    return clientLocation?.location ?? "";
  }

  /**
   * Scan the local blizzard product db for install WoW instances
   */
  public async getInstalledProducts(blizzardAgentPath: string): Promise<Map<WowClientType, InstalledProduct>> {
    const decodedProducts = await this.decodeProducts(blizzardAgentPath);
    const resolvedProducts = this._impl.resolveProducts(decodedProducts, blizzardAgentPath);
    const dictionary = new Map<WowClientType, InstalledProduct>();

    for (const product of resolvedProducts) {
      dictionary.set(product.clientType, product);
    }

    return dictionary;
  }

  public getAddonFolderPath(installation: WowInstallation): string {
    const installDir = path.dirname(installation.location);
    return path.join(installDir, constants.WOW_INTERFACE_FOLDER_NAME, constants.WOW_ADDON_FOLDER_NAME);
  }

  public async listAddons(installation: WowInstallation, scanSymlinks = false): Promise<AddonFolder[]> {
    const addonFolders: AddonFolder[] = [];
    if (!installation) {
      return addonFolders;
    }

    const addonFolderPath = this.getAddonFolderPath(installation);

    // Folder may not exist if no addons have been installed
    const addonFolderExists = await this._fileService.pathExists(addonFolderPath);
    if (!addonFolderExists) {
      return addonFolders;
    }

    const directories = await this._fileService.listDirectories(addonFolderPath, scanSymlinks);
    const dirPaths = directories.map((dir) => path.join(addonFolderPath, dir));
    const dirStats = await this._fileService.statFiles(dirPaths);

    for (let i = 0; i < directories.length; i += 1) {
      const dir = directories[i];
      const addonFolder = await this.getAddonFolder(addonFolderPath, dir);
      if (!addonFolder) {
        console.warn(`Failed to get addonFolder, no toc found: ${dir}`);
        continue;
      }

      addonFolder.fileStats = dirStats[path.join(addonFolderPath, dir)];
      if (addonFolder) {
        addonFolders.push(addonFolder);
      }
    }

    return addonFolders;
  }

  public async getAddonFolder(addonFolderPath: string, dir: string): Promise<AddonFolder | undefined> {
    try {
      const dirPath = path.join(addonFolderPath, dir);
      const dirFiles = await this._fileService.readdir(dirPath);
      const tocFiles = dirFiles.filter((f) => path.extname(f) === ".toc");
      if (tocFiles.length === 0) {
        return undefined;
      }

      const tocs: Toc[] = [];
      for (const tocFile of tocFiles) {
        const tocPath = path.join(dirPath, tocFile);
        const toc = await this._tocService.parse(tocPath);
        tocs.push(toc);
      }

      return {
        name: dir,
        path: dirPath,
        status: "Pending",
        tocs: tocs,
      };
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  public async getBlizzardAgentPath(): Promise<string> {
    const storedAgentPath = await this._preferenceStorageService.getAsync(constants.BLIZZARD_AGENT_PATH_KEY);
    if (storedAgentPath) {
      return storedAgentPath;
    }

    const agentPath = await this._impl.getBlizzardAgentPath();
    await this._preferenceStorageService.setAsync(constants.BLIZZARD_AGENT_PATH_KEY, agentPath);

    return agentPath;
  }

  public getClientTypeForBinary(binaryPath: string): WowClientType {
    return this._impl.getClientType(binaryPath);
  }

  /**
   * Get the old style preference key for a WoW client type
   * @deprecated
   */
  public getLegacyClientLocationKey(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Retail:
        return constants.RETAIL_LOCATION_KEY;
      case WowClientType.Classic:
        return constants.CLASSIC_LOCATION_KEY;
      case WowClientType.ClassicEra:
        return constants.CLASSIC_LOCATION_KEY;
      case WowClientType.RetailPtr:
        return constants.RETAIL_PTR_LOCATION_KEY;
      case WowClientType.ClassicPtr:
        return constants.CLASSIC_PTR_LOCATION_KEY;
      case WowClientType.Beta:
        return constants.BETA_LOCATION_KEY;
      default:
        throw new Error(`Failed to get client location key: ${clientType}, ${getEnumName(WowClientType, clientType)}`);
    }
  }

  private async decodeProducts(productDbPath: string) {
    if (!productDbPath) {
      return [];
    }

    try {
      const productDb = await this._electronService.invoke<ProductDb>("decode-product-db", productDbPath);
      console.log("productDb", productDb);

      let wowProducts: InstalledProduct[] = productDb.products
        .filter((p) => p.family === "wow")
        .map((p) => ({
          location: p.client.location,
          name: p.client.name,
          clientType: this.getClientTypeForFolderName(p.client.name),
        }));

      wowProducts = wowProducts.filter((wp) => {
        const hasClientType = wp.clientType != WowClientType.None;
        if (!hasClientType) {
          console.warn("Invalid client type detected", wp);
        }
        return hasClientType;
      });

      console.log("wowProducts", wowProducts);

      return wowProducts;
    } catch (e) {
      console.error(`failed to decode product db at ${productDbPath}`);
      console.error(e);
      return [];
    }
  }

  private getImplementation(): WarcraftServiceImpl {
    if (this._electronService.isWin) {
      return new WarcraftServiceWin(this._electronService, this._fileService);
    }

    if (this._electronService.isMac) {
      return new WarcraftServiceMac(this._fileService);
    }

    if (this._electronService.isLinux) {
      return new WarcraftServiceLinux(this._electronService, this._fileService);
    }

    throw new Error("No warcraft service implementation found");
  }

  private getClientTypeForFolderName(folderName: string): WowClientType {
    switch (folderName) {
      case constants.WOW_RETAIL_FOLDER:
        return WowClientType.Retail;
      case constants.WOW_RETAIL_PTR_FOLDER:
        return WowClientType.RetailPtr;
      case constants.WOW_CLASSIC_ERA_FOLDER:
        return WowClientType.ClassicEra;
      case constants.WOW_CLASSIC_FOLDER:
        return WowClientType.Classic;
      case constants.WOW_CLASSIC_PTR_FOLDER:
        return WowClientType.ClassicPtr;
      case constants.WOW_BETA_FOLDER:
        return WowClientType.Beta;
      case constants.WOW_CLASSIC_BETA_FOLDER:
        return WowClientType.ClassicBeta;
      case constants.WOW_CLASSIC_ERA_PTR_FOLDER:
        return WowClientType.ClassicEraPtr;
      default:
        return WowClientType.None;
    }
  }
}
