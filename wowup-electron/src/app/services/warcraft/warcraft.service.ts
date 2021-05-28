import * as _ from "lodash";
import * as path from "path";
import { BehaviorSubject, from, Subject } from "rxjs";
import { filter, map } from "rxjs/operators";

import { Injectable } from "@angular/core";

import { ElectronService } from "../";
import {
  BLIZZARD_AGENT_PATH_KEY,
  WOW_BETA_FOLDER,
  WOW_CLASSIC_BETA_FOLDER,
  WOW_CLASSIC_ERA_FOLDER,
  WOW_CLASSIC_FOLDER,
  WOW_CLASSIC_PTR_FOLDER,
  WOW_RETAIL_FOLDER,
  WOW_RETAIL_PTR_FOLDER,
} from "../../../common/constants";
import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { InstalledProduct } from "../../models/warcraft/installed-product";
import { ProductDb } from "../../models/warcraft/product-db";
import { AddonFolder } from "../../models/wowup/addon-folder";
import { SelectItem } from "../../models/wowup/select-item";
import { WowInstallation } from "../../models/wowup/wow-installation";
import { getEnumList, getEnumName } from "../../utils/enum.utils";
import { FileService } from "../files/file.service";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { TocService } from "../toc/toc.service";
import { WarcraftServiceImpl } from "./warcraft.service.impl";
import { WarcraftServiceLinux } from "./warcraft.service.linux";
import { WarcraftServiceMac } from "./warcraft.service.mac";
import { WarcraftServiceWin } from "./warcraft.service.win";

// WOW STRINGS

const ADDON_FOLDER_NAME = "AddOns";
const INTERFACE_FOLDER_NAME = "Interface";

// PREFERENCE KEYS
const RETAIL_LOCATION_KEY = "wow_retail_location";
const RETAIL_PTR_LOCATION_KEY = "wow_retail_ptr_location";
const CLASSIC_LOCATION_KEY = "wow_classic_location";
const CLASSIC_PTR_LOCATION_KEY = "wow_classic_ptr_location";
const BETA_LOCATION_KEY = "wow_beta_location";

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

  private _productDbPath = "";

  public readonly products$ = this._productsSrc.asObservable();
  public readonly productsReady$ = this.products$.pipe(filter((products) => Array.isArray(products)));
  public readonly installedClientTypes$ = this._installedClientTypesSrc.asObservable();

  // Map the client types so that we can localize them
  public installedClientTypesSelectItems$ = this._installedClientTypesSrc.pipe(
    filter((clientTypes) => !!clientTypes),
    map((clientTypes) => {
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
    const dictionary = new Map<WowClientType, InstalledProduct>();

    for (const product of decodedProducts) {
      dictionary.set(product.clientType, product);
    }

    return dictionary;
  }

  public getAddonFolderPath(installation: WowInstallation): string {
    const installDir = path.dirname(installation.location);
    return path.join(installDir, INTERFACE_FOLDER_NAME, ADDON_FOLDER_NAME);
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
      const tocFile = dirFiles.find((f) => path.extname(f) === ".toc");
      if (!tocFile) {
        return undefined;
      }

      const tocPath = path.join(dirPath, tocFile);
      const toc = await this._tocService.parse(tocPath);
      const tocMetaData = await this._tocService.parseMetaData(tocPath);

      return {
        name: dir,
        path: dirPath,
        status: "Pending",
        toc: toc,
        tocMetaData: tocMetaData,
      };
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  // public getClientRelativePath(clientType: WowClientType, folderPath: string): string {
  //   const clientFolderName = this.getClientFolderName(clientType);
  //   const clientFolderIdx = folderPath.indexOf(clientFolderName);
  //   const relativePath = clientFolderIdx === -1 ? folderPath : folderPath.substring(0, clientFolderIdx);

  //   return path.normalize(relativePath);
  // }

  // private async isClientFolder(clientType: WowClientType, folderPath: string) {
  //   const clientFolderName = this.getClientFolderName(clientType);
  //   const relativePath = this.getClientRelativePath(clientType, folderPath);

  //   const executableName = this.getExecutableName(clientType);
  //   const executablePath = path.join(relativePath, clientFolderName, executableName);

  //   return await this._fileService.pathExists(executablePath);
  // }

  public async getBlizzardAgentPath() {
    const storedAgentPath = this._preferenceStorageService.get(BLIZZARD_AGENT_PATH_KEY);
    if (storedAgentPath) {
      return storedAgentPath;
    }

    const agentPath = await this._impl.getBlizzardAgentPath();
    this._preferenceStorageService.set(BLIZZARD_AGENT_PATH_KEY, agentPath);

    return agentPath;
  }

  public getClientTypeForBinary(binaryPath: string): WowClientType {
    return this._impl.getClientType(binaryPath);
  }

  public getClientFolderName(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Retail:
        return WOW_RETAIL_FOLDER;
      case WowClientType.ClassicEra:
        return WOW_CLASSIC_ERA_FOLDER;
      case WowClientType.Classic:
        return WOW_CLASSIC_FOLDER;
      case WowClientType.RetailPtr:
        return WOW_RETAIL_PTR_FOLDER;
      case WowClientType.ClassicPtr:
        return WOW_CLASSIC_PTR_FOLDER;
      case WowClientType.Beta:
        return WOW_BETA_FOLDER;
      case WowClientType.ClassicBeta:
        return WOW_CLASSIC_BETA_FOLDER;
      default:
        return "";
    }
  }

  public getLegacyClientLocationKey(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Retail:
        return RETAIL_LOCATION_KEY;
      case WowClientType.ClassicEra:
        return CLASSIC_LOCATION_KEY;
      case WowClientType.RetailPtr:
        return RETAIL_PTR_LOCATION_KEY;
      case WowClientType.ClassicPtr:
        return CLASSIC_PTR_LOCATION_KEY;
      case WowClientType.Beta:
        return BETA_LOCATION_KEY;
      default:
        throw new Error(`Failed to get client location key: ${clientType}, ${getEnumName(WowClientType, clientType)}`);
    }
  }

  private async decodeProducts(productDbPath: string) {
    if (!productDbPath || this._electronService.isLinux) {
      return [];
    }

    try {
      const productDbData = await this._fileService.readFileBuffer(productDbPath);
      const productDb = ProductDb.decode(productDbData);
      console.log("productDb", JSON.stringify(productDb));
      const wowProducts: InstalledProduct[] = productDb.products
        .filter((p) => p.family === "wow")
        .map((p) => ({
          location: p.client.location,
          name: p.client.name,
          clientType: this.getClientTypeForFolderName(p.client.name),
        }));

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
      return new WarcraftServiceLinux();
    }

    throw new Error("No warcraft service implementation found");
  }

  private getClientTypeForFolderName(folderName: string): WowClientType {
    switch (folderName) {
      case WOW_RETAIL_FOLDER:
        return WowClientType.Retail;
      case WOW_RETAIL_PTR_FOLDER:
        return WowClientType.RetailPtr;
      case WOW_CLASSIC_ERA_FOLDER:
        return WowClientType.ClassicEra;
      case WOW_CLASSIC_FOLDER:
        return WowClientType.Classic;
      case WOW_CLASSIC_PTR_FOLDER:
        return WowClientType.ClassicPtr;
      case WOW_BETA_FOLDER:
        return WowClientType.Beta;
      case WOW_CLASSIC_BETA_FOLDER:
        return WowClientType.ClassicBeta;
      default:
        return WowClientType.Retail;
    }
  }
}
