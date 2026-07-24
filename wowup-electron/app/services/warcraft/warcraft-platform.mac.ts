import * as fsp from "fs/promises";
import * as path from "path";

import {
  WOW_ANNIVERSARY_FOLDER,
  WOW_CLASSIC_ERA_FOLDER,
  WOW_CLASSIC_ERA_PTR_FOLDER,
  WOW_RETAIL_XPTR_FOLDER,
} from "../../../src/common/constants";
import { InstalledProduct, WowClientType } from "wowup-lib-core";

import { WarcraftPlatform } from "./warcraft-platform.service";

const WOW_RETAIL_NAME = "World of Warcraft.app";
const WOW_RETAIL_PTR_NAME = "World of Warcraft Test.app";
const WOW_RETAIL_BETA_NAME = "World of Warcraft Beta.app";
const WOW_CLASSIC_NAME = "World of Warcraft Classic.app";
const WOW_CLASSIC_PTR_NAME = "World of Warcraft Classic Test.app";
const WOW_CLASSIC_BETA_NAME = "World of Warcraft Classic Beta.app";

const WOW_APP_NAMES = [
  WOW_RETAIL_NAME,
  WOW_RETAIL_PTR_NAME,
  WOW_CLASSIC_NAME,
  WOW_CLASSIC_PTR_NAME,
  WOW_RETAIL_BETA_NAME,
  WOW_CLASSIC_BETA_NAME,
];

const BLIZZARD_AGENT_PATH = "/Users/Shared/Battle.net/Agent";
const BLIZZARD_PRODUCT_DB_NAME = "product.db";

export class WarcraftPlatformMac implements WarcraftPlatform {
  public getExecutableExtension(): string {
    return "app";
  }

  public isWowApplication(appName: string): boolean {
    return WOW_APP_NAMES.includes(appName);
  }

  public async getBlizzardAgentPath(): Promise<string> {
    const agentPath = path.join(BLIZZARD_AGENT_PATH, BLIZZARD_PRODUCT_DB_NAME);
    return (await pathExists(agentPath)) ? agentPath : "";
  }

  public getExecutableName(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Retail:
        return WOW_RETAIL_NAME;
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

  public resolveProducts(decodedProducts: InstalledProduct[]): InstalledProduct[] {
    return decodedProducts;
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  return fsp.access(filePath).then(() => true).catch(() => false);
}
