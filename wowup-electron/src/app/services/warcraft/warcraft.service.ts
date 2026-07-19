import * as path from "path";
import { BehaviorSubject } from "rxjs";
import { filter, map } from "rxjs/operators";

import { Injectable } from "@angular/core";

import * as constants from "../../../common/constants";
import { SelectItem } from "../../models/wowup/select-item";
import { getEnumName, getEnumList } from "wowup-lib-core";
import { FileService } from "../files/file.service";
import { TocService } from "../toc/toc.service";
import { WarcraftApiService } from "../api/warcraft-api.service";
import { AddonFolder, Toc, WowClientType } from "wowup-lib-core";
import { InstalledProduct, WowInstallation } from "wowup-lib-core";

@Injectable({
  providedIn: "root",
})
export class WarcraftService {
  private readonly _productsSrc = new BehaviorSubject<InstalledProduct[]>([]);
  private readonly _installedClientTypesSrc = new BehaviorSubject<WowClientType[] | undefined>(undefined);
  private readonly _allClientTypes = getEnumList<WowClientType>(WowClientType).filter(
    (clientType) => clientType !== WowClientType.None,
  );

  public readonly products$ = this._productsSrc.asObservable();
  public readonly productsReady$ = this.products$.pipe(filter((products) => Array.isArray(products)));
  public readonly installedClientTypes$ = this._installedClientTypesSrc.asObservable();

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
    }),
  );

  public constructor(
    private readonly _warcraftApiService: WarcraftApiService,
    private readonly _fileService: FileService,
    private readonly _tocService: TocService,
  ) {}

  public getExecutableName(clientType: WowClientType): Promise<string> {
    return this._warcraftApiService.getExecutableName(clientType);
  }

  public getExecutableExtension(): Promise<string> {
    return this._warcraftApiService.getExecutableExtension();
  }

  public async isWowApplication(appPath: string): Promise<boolean> {
    const pathExists = await this._fileService.pathExists(appPath);
    if (!pathExists) {
      return false;
    }

    const fileName = path.basename(appPath);
    return this._warcraftApiService.isWowApplication(fileName);
  }

  public getAllClientTypes(): WowClientType[] {
    return [...this._allClientTypes];
  }

  public getProductLocation(
    clientType: WowClientType,
    installedProducts: Map<WowClientType, InstalledProduct>,
  ): string {
    const clientLocation = installedProducts.get(clientType);
    return clientLocation?.location ?? "";
  }

  public getInstalledProducts(blizzardAgentPath: string): Promise<Map<WowClientType, InstalledProduct>> {
    return this._warcraftApiService.getInstalledProducts(blizzardAgentPath);
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

    const addonFolderExists = await this._fileService.pathExists(addonFolderPath);
    if (!addonFolderExists) {
      return addonFolders;
    }

    const directories = await this._fileService.listDirectories(addonFolderPath, scanSymlinks);
    const dirPaths = directories.map((dir) => path.join(addonFolderPath, dir));
    const dirStats = await this._fileService.statFiles(dirPaths);

    for (const dir of directories) {
      const addonFolder = await this.getAddonFolder(addonFolderPath, dir);
      if (!addonFolder) {
        console.warn(`Failed to get addonFolder, no toc found: ${dir}`);
        continue;
      }

      addonFolder.fileStats = dirStats[path.join(addonFolderPath, dir)];
      addonFolders.push(addonFolder);
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

  public getBlizzardAgentPath(): Promise<string> {
    return this._warcraftApiService.getBlizzardAgentPath();
  }

  public getClientTypeForBinary(binaryPath: string): Promise<WowClientType> {
    return this._warcraftApiService.getClientTypeForBinary(binaryPath);
  }

  /**
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
}
