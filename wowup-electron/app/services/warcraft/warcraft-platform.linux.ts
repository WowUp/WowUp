import * as fs from "fs";
import * as fsp from "fs/promises";
import * as os from "os";
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

const WOW_APP_NAMES = [
  WOW_RETAIL_NAME,
  WOW_RETAIL_PTR_NAME,
  WOW_RETAIL_BETA_NAME,
  WOW_CLASSIC_NAME,
  WOW_CLASSIC_PTR_NAME,
  WOW_CLASSIC_BETA_NAME,
];

const BLIZZARD_AGENT_PATH = path.join("drive_c", "ProgramData", "Battle.net", "Agent", "product.db");

/** Lutris' system config, native and Flatpak; its game_path is where Lutris creates one prefix per game */
const LUTRIS_CONFIG_PATHS = [".config/lutris/system.yml", ".var/app/net.lutris.Lutris/config/lutris/system.yml"];

/** Folders that hold one wine prefix per entry */
const PREFIX_PARENT_DIRS = [
  "Games",
  "Games/Heroic/Prefixes",
  ".local/share/bottles/bottles",
  ".var/app/com.usebottles.bottles/data/bottles/bottles",
];

/** Steam roots, native and Flatpak; ~/.steam/steam is usually a symlink to the first one */
const STEAM_ROOTS = [".local/share/Steam", ".steam/steam", ".var/app/com.valvesoftware.Steam/.local/share/Steam"];

export interface WarcraftPlatformLinuxDeps {
  homeDir: string;
}

export class WarcraftPlatformLinux implements WarcraftPlatform {
  public constructor(private readonly deps: WarcraftPlatformLinuxDeps = { homeDir: os.homedir() }) {}

  public getExecutableExtension(): string {
    return "exe";
  }

  public isWowApplication(appName: string): boolean {
    return WOW_APP_NAMES.includes(appName);
  }

  /**
   * Battle.net runs in a wine prefix on Linux, so its product.db lives in that prefix's drive_c.
   * Searches the prefixes of Lutris, plain wine, ~/Games (Lutris' default, Heroic), Bottles and Steam
   * (Proton) and returns every product.db found, since WoW clients can be spread over several prefixes
   * (e.g. Retail in Lutris, Forever in Steam). The paths have every symlink resolved.
   */
  public async getBlizzardAgentPaths(): Promise<string[]> {
    // A Set, since prefixes can share their drive_c (or parts of it) through symlinks
    const agentPaths = new Set<string>();
    for (const prefix of await this.getWinePrefixes()) {
      const agentPath = await realpath(path.join(prefix, BLIZZARD_AGENT_PATH));
      if (agentPath !== undefined) {
        agentPaths.add(agentPath);
      }
    }

    if (agentPaths.size === 0) {
      console.log("No blizzard products found");
    }
    for (const agentPath of agentPaths) {
      console.log(`Found blizzard products at ${agentPath}`);
    }

    return [...agentPaths];
  }

  public getExecutableName(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Retail:
      case WowClientType.Forever: // WoW Forever ships the retail binary, it is told apart by its install folder
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
      case WowClientType.ClassicBeta: // WoW Forever Beta is the same binary as WoW Beta, so we can return the same name for both
        return WOW_RETAIL_BETA_NAME;
      default:
        return "";
    }
  }

  public getClientType(binaryPath: string): WowClientType {
    const binaryName = path.basename(binaryPath);
    switch (binaryName) {
      case WOW_RETAIL_NAME:
        return binaryPath.toLowerCase().includes(WOW_FOREVER_FOLDER) ? WowClientType.Forever : WowClientType.Retail;
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
        return binaryPath.toLowerCase().includes(WOW_CLASSIC_BETA_FOLDER)
          ? WowClientType.ClassicBeta
          : WowClientType.Beta;
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
      // Battle.net stores Windows paths ("C:/Program Files (x86)/World of Warcraft"), sometimes with backslashes
      const location = path.join(agentPathPrefix, product.location.substring(3).replace(/\\/g, "/"));
      resolvedProducts.push({ ...product, location: realpathSync(location) ?? location });
    }

    return resolvedProducts;
  }

  /** Every wine prefix that might hold Battle.net, as real paths (symlinks resolved) without duplicates */
  public async getWinePrefixes(): Promise<string[]> {
    const home = this.deps.homeDir;
    const candidates: string[] = [];

    for (const gamePath of await this.getLutrisGamePaths()) {
      candidates.push(...(await listSubdirs(gamePath)));
    }

    candidates.push(path.join(home, ".wine"));

    for (const parentDir of PREFIX_PARENT_DIRS) {
      candidates.push(...(await listSubdirs(path.join(home, parentDir))));
    }

    for (const library of await this.getSteamLibraries()) {
      const compatDirs = await listSubdirs(path.join(library, "steamapps", "compatdata"));
      candidates.push(...compatDirs.map((dir) => path.join(dir, "pfx")));
    }

    const prefixes = new Set<string>();
    for (const candidate of candidates) {
      const prefix = await realpath(candidate);
      if (prefix !== undefined) {
        prefixes.add(prefix);
      }
    }

    return [...prefixes];
  }

  private async getLutrisGamePaths(): Promise<string[]> {
    const gamePaths: string[] = [];
    for (const configPath of LUTRIS_CONFIG_PATHS) {
      try {
        const lutrisConfig = await fsp.readFile(path.join(this.deps.homeDir, configPath), "utf-8");
        const match = /^\s*game_path:\s*(.+)$/m.exec(lutrisConfig);
        if (match !== null) {
          const gamePath = unquoteYaml(match[1].trim());
          gamePaths.push(gamePath.startsWith("~/") ? path.join(this.deps.homeDir, gamePath.slice(2)) : gamePath);
        }
      } catch {
        // Lutris isn't installed this way
      }
    }

    return gamePaths;
  }

  /** Steam roots plus the extra library folders listed in their libraryfolders.vdf, e.g. on other drives */
  private async getSteamLibraries(): Promise<string[]> {
    const libraries: string[] = [];
    for (const root of STEAM_ROOTS.map((steamRoot) => path.join(this.deps.homeDir, steamRoot))) {
      libraries.push(root);
      try {
        const vdf = await fsp.readFile(path.join(root, "steamapps", "libraryfolders.vdf"), "utf-8");
        for (const match of vdf.matchAll(/^\s*"path"\s+"(.+)"\s*$/gm)) {
          libraries.push(match[1].replace(/\\\\/g, "\\"));
        }
      } catch {
        // No Steam at this root
      }
    }

    return libraries;
  }
}

function unquoteYaml(value: string): string {
  const quoted = /^(["'])(.*)\1$/.exec(value);
  return quoted === null ? value : quoted[2];
}

/** Real paths of the directories in dirPath, including the ones reached through a symlink */
async function listSubdirs(dirPath: string): Promise<string[]> {
  let entries: fs.Dirent[];
  try {
    entries = await fsp.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const subdirs: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue;
    }

    const subdir = await realpath(path.join(dirPath, entry.name));
    if (subdir !== undefined && (await isDirectory(subdir))) {
      subdirs.push(subdir);
    }
  }

  return subdirs;
}

async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    return (await fsp.stat(dirPath)).isDirectory();
  } catch {
    return false;
  }
}

/** The path with every symlink resolved, undefined if it doesn't exist */
async function realpath(filePath: string): Promise<string | undefined> {
  try {
    return await fsp.realpath(filePath);
  } catch {
    return undefined;
  }
}

function realpathSync(filePath: string): string | undefined {
  try {
    return fs.realpathSync(filePath);
  } catch {
    return undefined;
  }
}
