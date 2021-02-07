import * as path from "path";
import { BehaviorSubject, from, Observable } from "rxjs";
import { filter, map, switchMap } from "rxjs/operators";

import { Injectable } from "@angular/core";

import { ElectronService } from "../";
import { BLIZZARD_AGENT_PATH_KEY } from "../../../common/constants";
import { InstalledProduct } from "../../models/warcraft/installed-product";
import { ProductDb } from "../../models/warcraft/product-db";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { AddonFolder } from "../../models/wowup/addon-folder";
import { SelectItem } from "../../models/wowup/select-item";
import { getEnumList, getEnumName } from "../../utils/enum.utils";
import { FileUtils } from "../../utils/file.utils";
import { FileService } from "../files/file.service";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { TocService } from "../toc/toc.service";
import { WarcraftServiceImpl } from "./warcraft.service.impl";
import { WarcraftServiceLinux } from "./warcraft.service.linux";
import { WarcraftServiceMac } from "./warcraft.service.mac";
import { WarcraftServiceWin } from "./warcraft.service.win";

// WOW STRINGS
const CLIENT_RETAIL_FOLDER = "_retail_";
const CLIENT_RETAIL_PTR_FOLDER = "_ptr_";
const CLIENT_CLASSIC_FOLDER = "_classic_";
const CLIENT_CLASSIC_PTR_FOLDER = "_classic_ptr_";
const CLIENT_BETA_FOLDER = "_beta_";
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

  public products$ = this._productsSrc.asObservable();
  public productsReady$ = this.products$.pipe(filter((products) => Array.isArray(products)));

  public installedClientTypes$ = this._installedClientTypesSrc.asObservable();

  // Map the client types so that we can localize them
  public installedClientTypesSelectItems$ = this._installedClientTypesSrc.pipe(
    filter((clientTypes) => !!clientTypes),
    map((clientTypes) => {
      return clientTypes.map(
        (ct): SelectItem<WowClientType> => {
          const clientTypeName = getEnumName(WowClientType, ct).toUpperCase();
          return {
            display: `COMMON.CLIENT_TYPES.${clientTypeName}`,
            value: ct,
          };
        }
      );
    })
  );

  constructor(
    private _electronService: ElectronService,
    private _fileService: FileService,
    private _preferenceStorageService: PreferenceStorageService,
    private _tocService: TocService
  ) {
    this._impl = this.getImplementation();

    from(this.loadBlizzardAgentPath())
      .pipe(
        map((productDbPath) => (this._productDbPath = productDbPath)),
        switchMap(() => from(this.scanProducts())),
        switchMap(() => from(this.getWowClientTypes())),
        map((installedClientTypes) => this._installedClientTypesSrc.next(installedClientTypes))
      )
      .subscribe();
  }

  public getExecutableName(clientType: WowClientType): string {
    return this._impl.getExecutableName(clientType);
  }

  public getFullExecutablePath(clientType: WowClientType): string {
    const clientLocation = this.getClientLocation(clientType);
    const clientFolder = this.getClientFolderName(clientType);
    const clientExecutable = this.getExecutableName(clientType);

    return path.join(clientLocation, clientFolder, clientExecutable);
  }

  public getFullClientPath(clientType: WowClientType): string {
    const clientLocation = this.getClientLocation(clientType);
    const clientFolder = this.getClientFolderName(clientType);

    return path.join(clientLocation, clientFolder);
  }

  public getAddonFolderPath(clientType: WowClientType): string {
    const fullClientPath = this.getFullClientPath(clientType);
    return path.join(fullClientPath, INTERFACE_FOLDER_NAME, ADDON_FOLDER_NAME);
  }

  public getAllClientTypes(): WowClientType[] {
    return [...this._allClientTypes];
  }

  /** Get a list of installed client types */
  public async getWowClientTypes(): Promise<WowClientType[]> {
    const clients: WowClientType[] = [];

    const clientTypes = this.getAllClientTypes();

    for (const clientType of clientTypes) {
      const clientLocation = this.getClientLocation(clientType);
      if (!clientLocation) {
        continue;
      }

      const locationExists = await this._fileService.pathExists(clientLocation);
      if (!locationExists) {
        continue;
      }

      clients.push(clientType);
    }

    return clients;
  }

  public getProductLocation(clientType: WowClientType, installedProducts: Map<string, InstalledProduct>): string {
    const clientFolderName = this.getClientFolderName(clientType);
    const clientLocation = installedProducts.get(clientFolderName);
    return clientLocation?.location ?? "";
  }

  public getBlizzardLocations(): Map<string, InstalledProduct> {
    const decodedProducts = this.decodeProducts(this._productDbPath);
    const dictionary = new Map<string, InstalledProduct>();

    for (const product of decodedProducts) {
      dictionary.set(product.name, product);
    }

    return dictionary;
  }

  public async scanProducts(): Promise<InstalledProduct[]> {
    const installedProducts: InstalledProduct[] = [];
    const decodedProducts = this.getBlizzardLocations();

    const clientTypes = this.getAllClientTypes();

    for (const clientType of clientTypes) {
      const clientFolderName = this.getClientFolderName(clientType);
      const clientLocation = this.getClientLocation(clientType);
      const productLocation = this.getProductLocation(clientType, decodedProducts);

      if (!clientLocation && !productLocation) {
        continue;
      }

      if (this.arePathsEqual(clientLocation, productLocation)) {
        continue;
      }

      // If the path that the user selected is valid, then move on.
      const isClientFolder = await this.isClientFolder(clientType, clientLocation);
      if (clientLocation && isClientFolder) {
        installedProducts.push({
          clientType,
          location: clientLocation,
          name: clientFolderName,
        });
        continue;
      }

      this.setClientLocation(clientType, productLocation);
      installedProducts.push({
        clientType,
        location: productLocation,
        name: clientFolderName,
      });
    }

    this.broadcastInstalledClients().subscribe();

    this._productsSrc.next(installedProducts);
    return installedProducts;
  }

  public async listAddons(clientType: WowClientType): Promise<AddonFolder[]> {
    const addonFolders: AddonFolder[] = [];
    if (clientType === WowClientType.None) {
      return addonFolders;
    }

    const addonFolderPath = this.getAddonFolderPath(clientType);

    // Folder may not exist if no addons have been installed
    const addonFolderExists = await this._fileService.pathExists(addonFolderPath);
    if (!addonFolderExists) {
      return addonFolders;
    }

    const directories = await this._fileService.listDirectories(addonFolderPath);
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

  private async getAddonFolder(addonFolderPath: string, dir: string): Promise<AddonFolder | undefined> {
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

  public getClientLocation(clientType: WowClientType): string {
    const clientLocationKey = this.getClientLocationKey(clientType);
    return this._preferenceStorageService.get(clientLocationKey) || "";
  }

  public setClientLocation(clientType: WowClientType, clientPath: string): void {
    const clientLocationKey = this.getClientLocationKey(clientType);
    return this._preferenceStorageService.set(clientLocationKey, clientPath);
  }

  public removeWowFolderPath(clientType: WowClientType): Observable<void> {
    const clientLocationKey = this.getClientLocationKey(clientType);
    this._preferenceStorageService.remove(clientLocationKey);

    return this.broadcastInstalledClients();
  }

  public async setWowFolderPath(clientType: WowClientType, folderPath: string): Promise<boolean> {
    const relativePath = this.getClientRelativePath(clientType, folderPath);

    const isClientFolder = await this.isClientFolder(clientType, relativePath);
    if (!isClientFolder) {
      return false;
    }

    console.debug("setClientLocation2");
    this.setClientLocation(clientType, relativePath);

    from(this.getWowClientTypes())
      .pipe(map((wowClientTypes) => this._installedClientTypesSrc.next(wowClientTypes)))
      .subscribe();

    return true;
  }

  public getClientRelativePath(clientType: WowClientType, folderPath: string): string {
    const clientFolderName = this.getClientFolderName(clientType);
    const clientFolderIdx = folderPath.indexOf(clientFolderName);
    const relativePath = clientFolderIdx === -1 ? folderPath : folderPath.substring(0, clientFolderIdx);

    return path.normalize(relativePath);
  }

  private async isClientFolder(clientType: WowClientType, folderPath: string) {
    const clientFolderName = this.getClientFolderName(clientType);
    const relativePath = this.getClientRelativePath(clientType, folderPath);

    const executableName = this.getExecutableName(clientType);
    const executablePath = path.join(relativePath, clientFolderName, executableName);

    return await this._fileService.pathExists(executablePath);
  }

  public getClientTypeForFolderName(folderName: string): WowClientType {
    switch (folderName) {
      case CLIENT_RETAIL_FOLDER:
        return WowClientType.Retail;
      case CLIENT_RETAIL_PTR_FOLDER:
        return WowClientType.RetailPtr;
      case CLIENT_CLASSIC_FOLDER:
        return WowClientType.Classic;
      case CLIENT_CLASSIC_PTR_FOLDER:
        return WowClientType.ClassicPtr;
      case CLIENT_BETA_FOLDER:
        return WowClientType.Beta;
      default:
        return WowClientType.Retail;
    }
  }

  public getClientFolderName(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Retail:
        return CLIENT_RETAIL_FOLDER;
      case WowClientType.Classic:
        return CLIENT_CLASSIC_FOLDER;
      case WowClientType.RetailPtr:
        return CLIENT_RETAIL_PTR_FOLDER;
      case WowClientType.ClassicPtr:
        return CLIENT_CLASSIC_PTR_FOLDER;
      case WowClientType.Beta:
        return CLIENT_BETA_FOLDER;
      default:
        return "";
    }
  }

  public getClientDisplayName(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Retail:
        return "Retail";
      case WowClientType.Classic:
        return "Classic";
      case WowClientType.RetailPtr:
        return "Retail PTR";
      case WowClientType.ClassicPtr:
        return "Classic PTR";
      case WowClientType.Beta:
        return "Beta";
      default:
        return "";
    }
  }

  public getClientLocationKey(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Retail:
        return RETAIL_LOCATION_KEY;
      case WowClientType.Classic:
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

  private broadcastInstalledClients() {
    return from(this.getWowClientTypes()).pipe(
      map((wowClientTypes) => this._installedClientTypesSrc.next(wowClientTypes))
    );
  }

  private decodeProducts(productDbPath: string) {
    if (!productDbPath || this._electronService.isLinux) {
      return [];
    }

    try {
      const productDbData = FileUtils.readFileSync(productDbPath);
      const productDb = ProductDb.decode(productDbData);
      const wowProducts: InstalledProduct[] = productDb.products
        .filter((p) => p.family === "wow")
        .map((p) => ({
          location: p.client.location,
          name: p.client.name,
          clientType: this.getClientTypeForFolderName(p.client.name),
        }));

      console.log("wowProducts", wowProducts);
      return wowProducts;
    } catch (e) {
      console.error(`failed to decode product db at ${productDbPath}`);
      console.error(e);
      return [];
    }
  }

  private arePathsEqual(path1: string, path2: string) {
    return path.normalize(path1) === path.normalize(path2);
  }

  private getImplementation(): WarcraftServiceImpl {
    if (this._electronService.isWin) {
      return new WarcraftServiceWin(this._electronService, this._fileService);
    }

    if (this._electronService.isMac) {
      return new WarcraftServiceMac();
    }

    if (this._electronService.isLinux) {
      return new WarcraftServiceLinux();
    }

    throw new Error("No warcraft service implementation found");
  }

  private async loadBlizzardAgentPath() {
    const storedAgentPath = this._preferenceStorageService.get(BLIZZARD_AGENT_PATH_KEY);
    if (storedAgentPath) {
      return storedAgentPath;
    }

    const agentPath = await this._impl.getBlizzardAgentPath();
    this._preferenceStorageService.set(BLIZZARD_AGENT_PATH_KEY, agentPath);

    return agentPath;
  }
}
