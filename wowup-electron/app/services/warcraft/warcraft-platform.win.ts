import * as fsp from "fs/promises";
import * as nodeDiskInfo from "node-disk-info";
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

const WOW_RETAIL_NAME_ARM64 = "Wow-arm64.exe";
const WOW_RETAIL_PTR_NAME_ARM64 = "WowT-arm64.exe";
const WOW_RETAIL_BETA_NAME_ARM64 = "WowB-arm64.exe";
const WOW_CLASSIC_NAME_ARM64 = "WowClassic-arm64.exe";
const WOW_CLASSIC_PTR_NAME_ARM64 = "WowClassicT-arm64.exe";
const WOW_CLASSIC_BETA_NAME_ARM64 = "WowClassicB-arm64.exe";
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

const WOW_APP_NAMES_ARM64 = [
  WOW_RETAIL_NAME_ARM64,
  WOW_RETAIL_PTR_NAME_ARM64,
  WOW_RETAIL_BETA_NAME_ARM64,
  WOW_CLASSIC_NAME_ARM64,
  WOW_CLASSIC_PTR_NAME_ARM64,
  WOW_CLASSIC_BETA_NAME_ARM64,
];

const WINDOWS_BLIZZARD_AGENT_PATH = "ProgramData/Battle.net/Agent";
const BLIZZARD_PRODUCT_DB_NAME = "product.db";

export class WarcraftPlatformWin implements WarcraftPlatform {
  private get isArm64(): boolean {
    return process.arch === "arm64";
  }

  public getExecutableExtension(): string {
    return "exe";
  }

  public isWowApplication(appName: string): boolean {
    const nameList = this.isArm64 ? WOW_APP_NAMES_ARM64 : WOW_APP_NAMES;
    return nameList.includes(appName);
  }

  public async getBlizzardAgentPath(): Promise<string> {
    try {
      const diskInfos = await nodeDiskInfo.getDiskInfo();
      for (const disk of diskInfos) {
        const agentPath = path.join(disk.mounted, WINDOWS_BLIZZARD_AGENT_PATH, BLIZZARD_PRODUCT_DB_NAME);
        if (await pathExists(agentPath)) {
          console.log(`Found products at ${agentPath}`);
          return agentPath;
        }
      }
    } catch (e) {
      console.error("Failed to search for blizzard products", e);
    }

    return "";
  }

  public getExecutableName(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Retail:
        return this.isArm64 ? WOW_RETAIL_NAME_ARM64 : WOW_RETAIL_NAME;
      case WowClientType.Ascension:
        return ASCENSION_NAME;
      case WowClientType.ClassicEra:
      case WowClientType.Classic:
      case WowClientType.Anniversary:
        return this.isArm64 ? WOW_CLASSIC_NAME_ARM64 : WOW_CLASSIC_NAME;
      case WowClientType.RetailPtr:
      case WowClientType.RetailXPtr:
        return this.isArm64 ? WOW_RETAIL_PTR_NAME_ARM64 : WOW_RETAIL_PTR_NAME;
      case WowClientType.ClassicPtr:
      case WowClientType.ClassicEraPtr:
        return this.isArm64 ? WOW_CLASSIC_PTR_NAME_ARM64 : WOW_CLASSIC_PTR_NAME;
      case WowClientType.Beta:
        return this.isArm64 ? WOW_RETAIL_BETA_NAME_ARM64 : WOW_RETAIL_BETA_NAME;
      case WowClientType.ClassicBeta:
        return this.isArm64 ? WOW_CLASSIC_BETA_NAME_ARM64 : WOW_CLASSIC_BETA_NAME;
      default:
        return "";
    }
  }

  public getClientType(binaryPath: string): WowClientType {
    const binaryName = path.basename(binaryPath);
    if (binaryName === ASCENSION_NAME) {
      return WowClientType.Ascension;
    }

    if (
      (binaryName === WOW_RETAIL_NAME || binaryName === WOW_RETAIL_NAME_ARM64) &&
      binaryPath.toLowerCase().includes(ASCENSION_PATH_MARKER)
    ) {
      return WowClientType.Ascension;
    }

    let clientType: WowClientType = WowClientType.None;
    switch (binaryName) {
      case WOW_RETAIL_NAME:
      case WOW_RETAIL_NAME_ARM64:
        clientType = WowClientType.Retail;
        break;
      case WOW_CLASSIC_NAME:
      case WOW_CLASSIC_NAME_ARM64:
        if (binaryPath.toLowerCase().includes(WOW_CLASSIC_ERA_FOLDER)) {
          clientType = WowClientType.ClassicEra;
        } else if (binaryPath.toLowerCase().includes(WOW_ANNIVERSARY_FOLDER)) {
          clientType = WowClientType.Anniversary;
        } else {
          clientType = WowClientType.Classic;
        }
        break;
      case WOW_RETAIL_PTR_NAME:
      case WOW_RETAIL_PTR_NAME_ARM64:
        clientType = binaryPath.toLowerCase().includes(WOW_RETAIL_XPTR_FOLDER)
          ? WowClientType.RetailXPtr
          : WowClientType.RetailPtr;
        break;
      case WOW_CLASSIC_PTR_NAME:
      case WOW_CLASSIC_PTR_NAME_ARM64:
        clientType = binaryPath.toLowerCase().includes(WOW_CLASSIC_ERA_PTR_FOLDER)
          ? WowClientType.ClassicEraPtr
          : WowClientType.ClassicPtr;
        break;
      case WOW_RETAIL_BETA_NAME:
      case WOW_RETAIL_BETA_NAME_ARM64:
        clientType = WowClientType.Beta;
        break;
      case WOW_CLASSIC_BETA_NAME:
      case WOW_CLASSIC_BETA_NAME_ARM64:
        clientType = WowClientType.ClassicBeta;
        break;
      default:
        clientType = WowClientType.None;
    }

    if (clientType === WowClientType.None) {
      console.warn(`Unknown client type for binary path: ${binaryPath}`);
    }

    return clientType;
  }

  public resolveProducts(decodedProducts: InstalledProduct[]): InstalledProduct[] {
    return decodedProducts;
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  return fsp
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}
