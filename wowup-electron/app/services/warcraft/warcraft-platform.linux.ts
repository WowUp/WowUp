import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";

import {
  WOW_ANNIVERSARY_FOLDER,
  WOW_CLASSIC_ERA_FOLDER,
  WOW_CLASSIC_ERA_PTR_FOLDER,
  WOW_RETAIL_XPTR_FOLDER,
} from "../../../src/common/constants";
import { InstalledProduct, WowClientType } from "wowup-lib-core";

import { WarcraftPlatform } from "./warcraft-platform.service";

const WOW_RETAIL_NAME = "Wow.exe";
const WOW_RETAIL_PTR_NAME = "WowT.exe";
const WOW_RETAIL_BETA_NAME = "WowB.exe";
const WOW_CLASSIC_NAME = "WowClassic.exe";
const WOW_CLASSIC_PTR_NAME = "WowClassicT.exe";
const WOW_CLASSIC_BETA_NAME = "WowClassicB.exe";
const ASCENSION_NAME = "Ascension.exe";
const ASCENSION_PATH_MARKER = "ascension";

const WOW_APP_NAMES = [
  WOW_RETAIL_NAME,
  WOW_RETAIL_PTR_NAME,
  WOW_RETAIL_BETA_NAME,
  WOW_CLASSIC_NAME,
  WOW_CLASSIC_PTR_NAME,
  WOW_CLASSIC_BETA_NAME,
  ASCENSION_NAME,
];

const LUTRIS_CONFIG_PATH = "/.config/lutris/system.yml";
const LUTRIS_WOW_DIRS = ["battlenet/drive_c", "world-of-warcraft/drive_c", "world-of-warcraft-classic/drive_c"];

const WINDOWS_BLIZZARD_AGENT_PATH = "ProgramData/Battle.net/Agent";
const BLIZZARD_PRODUCT_DB_NAME = "product.db";

export class WarcraftPlatformLinux implements WarcraftPlatform {
  public getExecutableExtension(): string {
    return "exe";
  }

  public isWowApplication(appName: string): boolean {
    return WOW_APP_NAMES.includes(appName);
  }

  public async getBlizzardAgentPath(): Promise<string> {
    try {
      const lutrisLibraryPath = await this.getLutrisWowPath();
      if (lutrisLibraryPath.length === 0) {
        throw new Error("Lutris library not found");
      }

      const agentPath = path.join(lutrisLibraryPath, WINDOWS_BLIZZARD_AGENT_PATH, BLIZZARD_PRODUCT_DB_NAME);
      if (await pathExists(agentPath)) {
        console.log(`Found WoW products at ${agentPath}`);
        return agentPath;
      }
    } catch (e) {
      console.error("Failed to search for blizzard products", e);
    }

    return "";
  }

  public getExecutableName(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Retail:
        return WOW_RETAIL_NAME;
      case WowClientType.Ascension:
        return ASCENSION_NAME;
      case WowClientType.ClassicEra:
      case WowClientType.Classic:
      case WowClientType.Anniversary:
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
    if (binaryName === ASCENSION_NAME) {
      return WowClientType.Ascension;
    }

    if (binaryName === WOW_RETAIL_NAME && binaryPath.toLowerCase().includes(ASCENSION_PATH_MARKER)) {
      return WowClientType.Ascension;
    }

    switch (binaryName) {
      case WOW_RETAIL_NAME:
        return WowClientType.Retail;
      case WOW_CLASSIC_NAME:
        if (binaryPath.toLowerCase().includes(WOW_CLASSIC_ERA_FOLDER)) {
          return WowClientType.ClassicEra;
        } else if (binaryPath.toLowerCase().includes(WOW_ANNIVERSARY_FOLDER)) {
          return WowClientType.Anniversary;
        } else {
          return WowClientType.Classic;
        }
      case WOW_RETAIL_PTR_NAME:
        return binaryPath.toLowerCase().includes(WOW_RETAIL_XPTR_FOLDER)
          ? WowClientType.RetailXPtr
          : WowClientType.RetailPtr;
      case WOW_CLASSIC_PTR_NAME:
        return binaryPath.toLowerCase().includes(WOW_CLASSIC_ERA_PTR_FOLDER)
          ? WowClientType.ClassicEraPtr
          : WowClientType.ClassicPtr;
      case WOW_RETAIL_BETA_NAME:
        return WowClientType.Beta;
      case WOW_CLASSIC_BETA_NAME:
        return WowClientType.ClassicBeta;
      default:
        return WowClientType.None;
    }
  }

  public resolveProducts(decodedProducts: InstalledProduct[], agentPath: string): InstalledProduct[] {
    const agentPathPrefixRegex = /.*drive_c/;
    const resolvedProducts: InstalledProduct[] = [];

    for (const product of decodedProducts) {
      const match = agentPathPrefixRegex.exec(agentPath);
      if (match === null) {
        console.warn("No agentPath match found");
        continue;
      }

      const agentPathPrefix = match[0].trim();
      resolvedProducts.push({
        ...product,
        location: path.join(agentPathPrefix, product.location.substring(3)),
      });
    }

    return resolvedProducts;
  }

  private async getLutrisWowPath(): Promise<string> {
    const resolvedPath = path.join(os.homedir(), LUTRIS_CONFIG_PATH);
    try {
      if (!(await pathExists(resolvedPath))) {
        throw new Error("Lutris config not found");
      }

      const lutrisConfig = await fsp.readFile(resolvedPath, "utf-8");
      const match = /game_path: (.*)/.exec(lutrisConfig);
      if (match === null) {
        throw new Error("No matching game_path found");
      }

      const libraryPath = match[1].trim();
      if (!(await pathExists(libraryPath))) {
        throw new Error("Lutris library path does not exist");
      }

      for (const wowDir of LUTRIS_WOW_DIRS) {
        const productPath = path.join(libraryPath, wowDir);
        if (await pathExists(productPath)) {
          console.log(`Found WoW product in Lutris library at ${productPath}`);
          return productPath;
        }
      }
    } catch (e) {
      console.error("Failed to search for Lutris library location", e);
    }

    return "";
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  return fsp.access(filePath).then(() => true).catch(() => false);
}
