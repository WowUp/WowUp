import * as path from "path";
import { WowClientType } from "wowup-lib-core";
import { InstalledProduct } from "wowup-lib-core";
import { WOW_CLASSIC_ERA_FOLDER, WOW_CLASSIC_ERA_PTR_FOLDER, WOW_RETAIL_XPTR_FOLDER } from "../../../common/constants";
import { ElectronService } from "../electron/electron.service";
import { FileService } from "../files/file.service";
import { WarcraftServiceImpl } from "./warcraft.service.impl";

const WOW_RETAIL_NAME = "Wow.exe";
const WOW_RETAIL_PTR_NAME = "WowT.exe";
const WOW_RETAIL_BETA_NAME = "WowB.exe";
const WOW_CLASSIC_NAME = "WowClassic.exe";
const WOW_CLASSIC_PTR_NAME = "WowClassicT.exe";
const WOW_CLASSIC_BETA_NAME = "WowClassicB.exe";

const WOW_APP_NAMES = [
  WOW_RETAIL_NAME,
  WOW_RETAIL_PTR_NAME,
  WOW_RETAIL_BETA_NAME,
  WOW_CLASSIC_NAME,
  WOW_CLASSIC_PTR_NAME,
  WOW_CLASSIC_BETA_NAME,
];

const LUTRIS_CONFIG_PATH = "/.config/lutris/system.yml";
// Search in this order until products are found on one.
// All WoW products can be found under any or all of them,
// since each of them are essentially just Battle.net
// launchers with a different install path.
const LUTRIS_WOW_DIRS = ["battlenet/drive_c", "world-of-warcraft/drive_c", "world-of-warcraft-classic/drive_c"];

// BLIZZARD STRINGS
const WINDOWS_BLIZZARD_AGENT_PATH = "ProgramData/Battle.net/Agent";
const BLIZZARD_PRODUCT_DB_NAME = "product.db";

export class WarcraftServiceLinux implements WarcraftServiceImpl {
  public constructor(private _electronService: ElectronService, private _fileService: FileService) {}

  public getExecutableExtension(): string {
    return "exe";
  }

  public isWowApplication(appName: string): boolean {
    return WOW_APP_NAMES.includes(appName);
  }

  /**
   * On Linux players could be using Lutris to install the Battle.net launcher or WoW
   */
  public async getBlizzardAgentPath(): Promise<string> {
    try {
      const lutrisLibraryPath = await this.getLutrisWowPath();
      if (lutrisLibraryPath.length === 0) {
        throw new Error("Lutris library not found");
      }

      const agentPath = path.join(lutrisLibraryPath, WINDOWS_BLIZZARD_AGENT_PATH, BLIZZARD_PRODUCT_DB_NAME);
      const agentPathExists = await this._fileService.pathExists(agentPath);

      if (agentPathExists) {
        console.log(`Found WoW products at ${agentPath}`);
        return agentPath;
      }
    } catch (e) {
      console.error("Failed to search for blizzard products", e);
    }

    return "";
  }

  public resolveProducts(decodedProducts: InstalledProduct[], agentPath: string): InstalledProduct[] {
    const resolvedProducts: InstalledProduct[] = [];
    const agentPathPrefixRegex = new RegExp(`(.*drive_c)`);
    for (const product of decodedProducts) {
      console.log(`location: ${location.toString()} agentPath: ${agentPath}`);
      const regexResults = agentPathPrefixRegex.exec(agentPath);
      if (regexResults === null) {
        console.warn("No agentPath match found");
        continue;
      }

      const agentPathPrefix = regexResults[1].trim();
      resolvedProducts.push({
        ...product,
        location: path.join(agentPathPrefix, product.location.substr(3)),
      } as InstalledProduct);
    }
    return resolvedProducts;
  }

  public async getLutrisWowPath(): Promise<string> {
    const homeDir = await this._fileService.getHomeDir();
    const resolvedPath = path.join(homeDir, LUTRIS_CONFIG_PATH);
    try {
      const lutrisConfigExists = await this._fileService.pathExists(resolvedPath);
      if (lutrisConfigExists) {
        const lutrisConfig = await this._fileService.readFile(resolvedPath);
        const libraryPathRegex = new RegExp(`game_path: (.*)`);
        const regexResults = libraryPathRegex.exec(lutrisConfig);
        if (regexResults === null) {
          throw new Error("No matching game_path found");
        }

        const libraryPath = regexResults[1].trim();
        const libraryPathExists = await this._fileService.pathExists(libraryPath);
        if (libraryPathExists) {
          for (const wowDir of LUTRIS_WOW_DIRS) {
            const productPath = path.join(libraryPath, wowDir);
            const productPathExists = await this._fileService.pathExists(productPath);
            if (productPathExists) {
              console.log(`Found WoW product in Lutris library at ${productPath}`);
              return productPath;
            }
          }
        }
      }
      throw new Error();
    } catch (e) {
      console.error("Failed to search for Lutris library location", e);
    }
    return "";
  }

  public getExecutableName(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Retail:
        return WOW_RETAIL_NAME;
      case WowClientType.ClassicEra:
      case WowClientType.Classic:
        return WOW_CLASSIC_NAME;
      case WowClientType.RetailPtr:
      case WowClientType.RetailXPtr:
        return WOW_RETAIL_PTR_NAME;
      case WowClientType.ClassicPtr:
      case WowClientType.ClassicEraPtr:
        return WOW_CLASSIC_PTR_NAME;
      case WowClientType.Beta:
        return WOW_RETAIL_BETA_NAME;
      case WowClientType.ClassicBeta:
        return WOW_CLASSIC_BETA_NAME;
      default:
        return "";
    }
  }

  public getClientType(binaryPath: string): WowClientType {
    const binaryName = path.basename(binaryPath);
    switch (binaryName) {
      case WOW_RETAIL_NAME:
        return WowClientType.Retail;
      case WOW_CLASSIC_NAME:
        if (binaryPath.toLowerCase().includes(WOW_CLASSIC_ERA_FOLDER)) {
          return WowClientType.ClassicEra;
        } else {
          return WowClientType.Classic;
        }
      case WOW_RETAIL_PTR_NAME:
        if (binaryPath.toLowerCase().includes(WOW_RETAIL_XPTR_FOLDER)) {
          return WowClientType.RetailXPtr;
        } else {
          return WowClientType.RetailPtr;
        }
      case WOW_CLASSIC_PTR_NAME:
        if (binaryPath.toLowerCase().includes(WOW_CLASSIC_ERA_PTR_FOLDER)) {
          return WowClientType.ClassicEraPtr;
        } else {
          return WowClientType.ClassicPtr;
        }
      case WOW_RETAIL_BETA_NAME:
        return WowClientType.Beta;
      case WOW_CLASSIC_BETA_NAME:
        return WowClientType.ClassicBeta;
      default:
        return WowClientType.None;
    }
  }
}
