import * as fsp from "fs/promises";
import * as path from "path";

import {
  WOW_ANNIVERSARY_FOLDER,
  WOW_CLASSIC_BETA_FOLDER,
  WOW_CLASSIC_ERA_FOLDER,
  WOW_CLASSIC_ERA_PTR_FOLDER,
  WOW_FOREVER_FOLDER,
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

const WOW_RETAIL_NAME_ARM64 = "Wow-arm64.exe";
const WOW_RETAIL_PTR_NAME_ARM64 = "WowT-arm64.exe";
const WOW_RETAIL_BETA_NAME_ARM64 = "WowB-arm64.exe";
const WOW_CLASSIC_NAME_ARM64 = "WowClassic-arm64.exe";
const WOW_CLASSIC_PTR_NAME_ARM64 = "WowClassicT-arm64.exe";
const WOW_CLASSIC_BETA_NAME_ARM64 = "WowClassicB-arm64.exe";

const WOW_APP_NAMES = [
  WOW_RETAIL_NAME,
  WOW_RETAIL_PTR_NAME,
  WOW_RETAIL_BETA_NAME,
  WOW_CLASSIC_NAME,
  WOW_CLASSIC_PTR_NAME,
  WOW_CLASSIC_BETA_NAME,
];

const WOW_APP_NAMES_ARM64 = [
  WOW_RETAIL_NAME_ARM64,
  WOW_RETAIL_PTR_NAME_ARM64,
  WOW_RETAIL_BETA_NAME_ARM64,
  WOW_CLASSIC_NAME_ARM64,
  WOW_CLASSIC_PTR_NAME_ARM64,
  WOW_CLASSIC_BETA_NAME_ARM64,
];

const BLIZZARD_PRODUCT_DB_NAME = "product.db";
const DRIVE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export interface WarcraftPlatformWinDeps {
  pathExists: (filePath: string) => Promise<boolean>;
  /** %ProgramData%, where Battle.net installs its agent */
  programData: string | undefined;
}

/**
 * Where to look for Battle.net's product.db, in order of preference: %ProgramData% first, then the
 * ProgramData folder on every drive letter in case the variable is missing or points elsewhere.
 * Drives are probed by path rather than listed, since listing them needed wmic, which current
 * Windows 11 builds no longer install.
 */
export function getBlizzardAgentCandidates(programData: string | undefined): string[] {
  const driveProgramData = DRIVE_LETTERS.map((letter) => path.win32.join(`${letter}:\\`, "ProgramData"));
  const dirs = programData ? [programData, ...driveProgramData] : driveProgramData;

  // Windows paths are case-insensitive, so %ProgramData% usually duplicates one of the drive entries
  const candidates = new Map<string, string>();
  for (const dir of dirs) {
    const candidate = path.win32.join(dir, "Battle.net", "Agent", BLIZZARD_PRODUCT_DB_NAME);
    if (!candidates.has(candidate.toLowerCase())) {
      candidates.set(candidate.toLowerCase(), candidate);
    }
  }

  return [...candidates.values()];
}

export class WarcraftPlatformWin implements WarcraftPlatform {
  public constructor(
    private readonly deps: WarcraftPlatformWinDeps = { pathExists, programData: process.env.ProgramData },
  ) {}

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
    const candidates = getBlizzardAgentCandidates(this.deps.programData);

    // Probed together rather than one by one: an unavailable network drive can take a while to fail
    const found = await Promise.all(candidates.map((candidate) => this.deps.pathExists(candidate)));
    const agentPath = candidates.find((_, i) => found[i]);
    if (agentPath === undefined) {
      console.log("No blizzard products found");
      return "";
    }

    console.log(`Found products at ${agentPath}`);
    return agentPath;
  }

  public getExecutableName(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Retail:
      case WowClientType.Forever: // WoW Forever ships the retail binary, it is told apart by its install folder
        return this.isArm64 ? WOW_RETAIL_NAME_ARM64 : WOW_RETAIL_NAME;
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
      case WowClientType.ClassicBeta: // WoW Forever Beta is the same binary as WoW Beta, so we can return the same name for both
        return this.isArm64 ? WOW_RETAIL_BETA_NAME_ARM64 : WOW_RETAIL_BETA_NAME;
      default:
        return "";
    }
  }

  public getClientType(binaryPath: string): WowClientType {
    const binaryName = path.basename(binaryPath);
    let clientType: WowClientType = WowClientType.None;
    switch (binaryName) {
      case WOW_RETAIL_NAME:
      case WOW_RETAIL_NAME_ARM64:
        clientType = binaryPath.toLowerCase().includes(WOW_FOREVER_FOLDER)
          ? WowClientType.Forever
          : WowClientType.Retail;
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
        clientType = binaryPath.toLowerCase().includes(WOW_CLASSIC_BETA_FOLDER)
          ? WowClientType.ClassicBeta
          : WowClientType.Beta;
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
